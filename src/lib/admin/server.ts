import "server-only";

import { getKeyPlans, removeKeyFromPlan, setKeyEnabled } from "@/lib/aws/apiKeys";
import { syncSubscription } from "@/lib/billing/provision";
import { provisionDeps } from "@/lib/billing/server";
import { createServiceClient } from "@/lib/supabase/admin";

import { auditSink } from "./audit";
import type { AdminKeyDeps } from "./keys";
import type { SsoDeps, SsoDomain } from "./sso";

// Wires the admin key and SSO operations to Supabase (service role) and the
// AWS adapter. Callers have already passed requireAdmin().

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

export function adminKeyDeps(): AdminKeyDeps {
  const db = createServiceClient();
  return {
    async getKey(keyId) {
      const { data, error } = await db
        .from("api_keys")
        .select("id, org_id, enabled, usage_plan_id, disabled_by_admin")
        .eq("id", keyId)
        .maybeSingle<{
          id: string;
          org_id: string;
          enabled: boolean;
          usage_plan_id: string | null;
          disabled_by_admin: boolean;
        }>();
      if (error) fail("reading the key", error);
      if (!data) return null;
      const { data: sub, error: subError } = await db
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("api_key_id", keyId)
        .eq("expired", false)
        .maybeSingle<{ stripe_subscription_id: string }>();
      if (subError) fail("reading the key's subscription", subError);
      return {
        id: data.id,
        orgId: data.org_id,
        enabled: data.enabled,
        usagePlanId: data.usage_plan_id,
        disabledByAdmin: data.disabled_by_admin,
        subscriptionId: sub?.stripe_subscription_id ?? null,
      };
    },
    async switchOffInAws(keyId) {
      await setKeyEnabled(keyId, false);
      for (const plan of await getKeyPlans(keyId)) await removeKeyFromPlan(keyId, plan);
    },
    async saveKey(keyId, state) {
      const { error } = await db
        .from("api_keys")
        .update({
          enabled: state.enabled,
          usage_plan_id: state.usagePlanId,
          disabled_by_admin: state.disabledByAdmin,
        })
        .eq("id", keyId);
      if (error) fail("saving the key", error);
    },
    async syncSubscription(subscriptionId) {
      await syncSubscription(provisionDeps(), subscriptionId, null);
    },
    audit: auditSink(db),
  };
}

type SsoRow = {
  domain: string;
  org_id: string;
  supabase_sso_provider_id: string;
  default_role: "developer" | "member";
  enabled: boolean;
};

const toSso = (row: SsoRow): SsoDomain => ({
  domain: row.domain,
  orgId: row.org_id,
  providerId: row.supabase_sso_provider_id,
  defaultRole: row.default_role,
  enabled: row.enabled,
});

export function ssoDeps(): SsoDeps {
  const db = createServiceClient();
  return {
    async get(domain) {
      const { data, error } = await db
        .from("sso_domains")
        .select("domain, org_id, supabase_sso_provider_id, default_role, enabled")
        .eq("domain", domain)
        .maybeSingle<SsoRow>();
      if (error) fail("reading the SSO domain", error);
      return data ? toSso(data) : null;
    },
    async orgExists(orgId) {
      const { count, error } = await db
        .from("organisations")
        .select("id", { count: "exact", head: true })
        .eq("id", orgId);
      if (error) fail("reading the organisation", error);
      return (count ?? 0) > 0;
    },
    async save(row) {
      const { error } = await db.from("sso_domains").upsert(
        {
          domain: row.domain,
          org_id: row.orgId,
          supabase_sso_provider_id: row.providerId,
          default_role: row.defaultRole,
          enabled: row.enabled,
        },
        { onConflict: "domain" },
      );
      if (error) fail("saving the SSO domain", error);
    },
    async remove(domain) {
      const { error } = await db.from("sso_domains").delete().eq("domain", domain);
      if (error) fail("removing the SSO domain", error);
    },
    audit: auditSink(db),
  };
}

export type SsoListItem = SsoDomain & { orgName: string | null; updatedAt: Date };

export async function listSsoDomains(): Promise<SsoListItem[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("sso_domains")
    .select(
      "domain, org_id, supabase_sso_provider_id, default_role, enabled, updated_at, organisations (name)",
    )
    .order("domain")
    .returns<Array<SsoRow & { updated_at: string; organisations: { name: string } | null }>>();
  if (error) fail("reading SSO domains", error);
  return data.map((row) => ({
    ...toSso(row),
    orgName: row.organisations?.name ?? null,
    updatedAt: new Date(row.updated_at),
  }));
}

/** Every organisation's ID and name, for pickers. */
export async function organisationOptions(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await createServiceClient()
    .from("organisations")
    .select("id, name")
    .order("name")
    .limit(2000)
    .returns<Array<{ id: string; name: string }>>();
  if (error) fail("reading organisations", error);
  return data;
}

export type AdminPerson = {
  id: string;
  email: string;
  name: string | null;
  hasMfa: boolean | null;
  createdAt: Date;
};

/** Mintly admins, with whether each has an authenticator app (SEC-01). */
export async function listAdmins(): Promise<AdminPerson[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("profiles")
    .select("id, email, first_name, last_name, created_at")
    .eq("is_mintly_admin", true)
    .order("email")
    .returns<
      Array<{
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
        created_at: string;
      }>
    >();
  if (error) fail("reading admins", error);
  return Promise.all(
    data.map(async (p) => {
      const { data: factors, error: mfaError } = await db.auth.admin.mfa.listFactors({
        userId: p.id,
      });
      return {
        id: p.id,
        email: p.email,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
        hasMfa: mfaError
          ? null
          : (factors?.factors ?? []).some(
              (f) => f.factor_type === "totp" && f.status === "verified",
            ),
        createdAt: new Date(p.created_at),
      };
    }),
  );
}

export async function findProfileByEmail(
  email: string,
): Promise<{ id: string; email: string; isMintlyAdmin: boolean } | null> {
  const { data, error } = await createServiceClient()
    .from("profiles")
    .select("id, email, is_mintly_admin")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle<{ id: string; email: string; is_mintly_admin: boolean }>();
  if (error) fail("finding the user", error);
  return data ? { id: data.id, email: data.email, isMintlyAdmin: data.is_mintly_admin } : null;
}
