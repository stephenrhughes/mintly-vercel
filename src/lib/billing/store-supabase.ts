import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { OrgRole, ReviewStatus } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/admin";

import type { BillingStore, EventClaim } from "./store";

// BillingStore on Supabase, with the service role. Only the Stripe webhook
// and provisioning use it, after the event's signature has been verified.

const iso = (date: Date | null) => (date ? date.toISOString() : null);

function fail(what: string, error: { message: string; code?: string } | null): never {
  throw new Error(
    `${what} failed: ${error?.code ?? ""} ${error?.message ?? "unknown error"}`.trim(),
  );
}

type PersonRow = { email: string; marketing_opt_out: boolean };

export function createSupabaseBillingStore(
  db: SupabaseClient = createServiceClient(),
): BillingStore {
  return {
    async claimEvent(id, type): Promise<EventClaim> {
      const inserted = await db
        .from("stripe_events")
        .upsert({ id, type }, { onConflict: "id", ignoreDuplicates: true })
        .select("id");
      if (inserted.error) fail("recording the Stripe event", inserted.error);
      if (inserted.data.length > 0) return "new";

      const existing = await db
        .from("stripe_events")
        .select("processed_at")
        .eq("id", id)
        .single<{ processed_at: string | null }>();
      if (existing.error) fail("reading the Stripe event", existing.error);
      return existing.data.processed_at ? "processed" : "retry";
    },

    async markEventProcessed(id) {
      const { error } = await db
        .from("stripe_events")
        .update({ processed_at: new Date().toISOString(), error: null })
        .eq("id", id);
      if (error) fail("marking the Stripe event processed", error);
    },

    async markEventFailed(id, message) {
      const { error } = await db.from("stripe_events").update({ error: message }).eq("id", id);
      if (error) console.error("marking the Stripe event failed", error.message);
    },

    async tryLock(key) {
      const { data, error } = await db.rpc("try_provision_lock", { p_key: key });
      if (error) fail("taking the provisioning lock", error);
      return data === true;
    },

    async releaseLock(key) {
      const { error } = await db.from("provision_locks").delete().eq("key", key);
      if (error) console.error("releasing the provisioning lock", error.message);
    },

    async findOrgByCustomer(stripeCustomerId) {
      const { data, error } = await db
        .from("organisations")
        .select("id, name, review_status")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle<{ id: string; name: string; review_status: ReviewStatus }>();
      if (error) fail("finding the organisation", error);
      return data ? { id: data.id, name: data.name, reviewStatus: data.review_status } : null;
    },

    async provisionOrganisation(input) {
      const { data: orgId, error } = await db.rpc("provision_organisation", {
        p_name: input.name,
        p_stripe_customer_id: input.stripeCustomerId,
        p_owner_id: input.ownerId,
        p_review_status: input.reviewStatus,
        p_signup_signals: input.signupSignals,
      });
      if (error) fail("creating the organisation", error);
      const { data, error: readError } = await db
        .from("organisations")
        .select("id, name, review_status")
        .eq("id", orgId)
        .single<{ id: string; name: string; review_status: ReviewStatus }>();
      if (readError) fail("reading the new organisation", readError);
      return { id: data.id, name: data.name, reviewStatus: data.review_status };
    },

    async getSubscription(stripeSubscriptionId) {
      const { data, error } = await db
        .from("subscriptions")
        .select("api_key_id, trialing, expired, cancel_at")
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .maybeSingle<{
          api_key_id: string | null;
          trialing: boolean;
          expired: boolean;
          cancel_at: string | null;
        }>();
      if (error) fail("reading the subscription", error);
      return data
        ? {
            apiKeyId: data.api_key_id,
            trialing: data.trialing,
            expired: data.expired,
            cancelAt: data.cancel_at ? new Date(data.cancel_at) : null,
          }
        : null;
    },

    async getKey(keyId) {
      return readKey(db, "id", keyId);
    },

    async getKeyForItem(itemId) {
      return readKey(db, "stripe_subscription_item_id", itemId);
    },

    async hasOtherKeys(orgId, keyId) {
      const { count, error } = await db
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .neq("id", keyId);
      if (error) fail("counting keys", error);
      return (count ?? 0) > 0;
    },

    async saveKey(input) {
      const { error } = await db.from("api_keys").upsert(
        {
          id: input.id,
          org_id: input.orgId,
          product: input.product,
          stripe_subscription_item_id: input.stripeSubscriptionItemId,
          enabled: input.enabled,
          usage_plan_id: input.usagePlanId,
        },
        { onConflict: "id" },
      );
      if (error) fail("saving the key", error);
    },

    async saveSubscription({ orgId, record, apiKeyId, keyNoticeAt }) {
      const { error } = await db.from("subscriptions").upsert(
        {
          org_id: orgId,
          product: record.product,
          stripe_subscription_id: record.stripeSubscriptionId,
          stripe_subscription_item_id: record.stripeSubscriptionItemId,
          stripe_price_id: record.stripePriceId,
          status: record.status,
          trialing: record.trialing,
          trial_end: iso(record.trialEnd),
          current_period_end: iso(record.currentPeriodEnd),
          cancel_at: iso(record.cancelAt),
          expired: record.expired,
          max_team_size: record.maxTeamSize,
          extra_users: record.extraUsers,
          usage_plan_id: record.usagePlanId,
          api_key_id: apiKeyId,
          // Only ever set here, never cleared: dismissal is recorded separately.
          ...(keyNoticeAt ? { key_notice_at: iso(keyNoticeAt) } : {}),
          updated_from_stripe_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
      );
      if (error) fail("saving the subscription", error);
    },

    async getProfile(userId) {
      const { data, error } = await db
        .from("profiles")
        .select("email, marketing_opt_out, company_name")
        .eq("id", userId)
        .maybeSingle<PersonRow & { company_name: string | null }>();
      if (error) fail("reading the profile", error);
      return data
        ? {
            email: data.email,
            marketingOptOut: data.marketing_opt_out,
            companyName: data.company_name,
          }
        : null;
    },

    async getOwner(orgId) {
      const [owner] = await people(db, orgId, ["owner"]);
      return owner ?? null;
    },

    async getKeyHolders(orgId) {
      return people(db, orgId, ["owner", "developer"]);
    },
  };
}

async function readKey(db: SupabaseClient, column: string, value: string) {
  const { data, error } = await db
    .from("api_keys")
    .select("id, enabled, usage_plan_id")
    .eq(column, value)
    .maybeSingle<{ id: string; enabled: boolean; usage_plan_id: string | null }>();
  if (error) fail("reading the key", error);
  return data ? { id: data.id, enabled: data.enabled, usagePlanId: data.usage_plan_id } : null;
}

async function people(db: SupabaseClient, orgId: string, roles: OrgRole[]) {
  // memberships and profiles both reference auth.users rather than each
  // other, so PostgREST can't embed one in the other: two queries.
  const members = await db
    .from("memberships")
    .select("user_id, role")
    .eq("org_id", orgId)
    .in("role", roles)
    .returns<Array<{ user_id: string; role: OrgRole }>>();
  if (members.error) fail("reading the team", members.error);
  if (members.data.length === 0) return [];

  const profiles = await db
    .from("profiles")
    .select("id, email, marketing_opt_out")
    .in(
      "id",
      members.data.map((m) => m.user_id),
    )
    .returns<Array<PersonRow & { id: string }>>();
  if (profiles.error) fail("reading the team's profiles", profiles.error);

  // Keep the role order asked for (the owner first).
  const byId = new Map(profiles.data.map((p) => [p.id, p]));
  return [...members.data]
    .sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role))
    .flatMap((m) => {
      const p = byId.get(m.user_id);
      return p ? [{ email: p.email, marketingOptOut: p.marketing_opt_out }] : [];
    });
}
