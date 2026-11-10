// SSO domains (plan §6.1, §6.8, SSO-07): which email domain signs in through
// which Supabase SAML provider, and joins which organisation. The identity
// provider itself is registered with the Supabase CLI; this manages the
// mapping, audited.

import { z } from "zod";

import { normaliseDomain } from "@/lib/review/rules";

import { type AuditSink, errorText } from "./audit";

export type SsoDomain = {
  domain: string;
  orgId: string;
  providerId: string;
  defaultRole: "developer" | "member";
  enabled: boolean;
};

const schema = z.object({
  domain: z.string().transform((value, ctx) => {
    const domain = normaliseDomain(value);
    if (!domain) {
      ctx.addIssue({ code: "custom", message: "Enter a domain, for example acme.co.uk." });
      return z.NEVER;
    }
    return domain;
  }),
  orgId: z.uuid({ message: "Choose the organisation." }),
  providerId: z.uuid({ message: "Paste the provider ID that `supabase sso add` printed." }),
  defaultRole: z.enum(["developer", "member"], { message: "Choose Developer or Member." }),
  enabled: z.boolean(),
});

/** Reads and checks an SSO domain from a form. */
export function parseSsoDomain(
  input: Record<string, unknown>,
): { ok: true; value: SsoDomain } | { ok: false; error: string } {
  const result = schema.safeParse(input);
  if (!result.success)
    return { ok: false, error: result.error.issues[0]?.message ?? "Check the form." };
  return { ok: true, value: result.data };
}

export type SsoDeps = {
  get(domain: string): Promise<SsoDomain | null>;
  orgExists(orgId: string): Promise<boolean>;
  save(row: SsoDomain): Promise<void>;
  remove(domain: string): Promise<void>;
  audit: AuditSink;
};

export type SsoResult = { ok: true; message: string } | { ok: false; error: string };

const asJson = (row: SsoDomain) => ({
  domain: row.domain,
  org_id: row.orgId,
  supabase_sso_provider_id: row.providerId,
  default_role: row.defaultRole,
  enabled: row.enabled,
});

export async function saveSsoDomain(
  deps: SsoDeps,
  input: { row: SsoDomain; actorId: string; isNew: boolean },
): Promise<SsoResult> {
  const { row } = input;
  if (!(await deps.orgExists(row.orgId))) return { ok: false, error: "Organisation not found." };
  const existing = await deps.get(row.domain);
  if (input.isNew && existing) return { ok: false, error: `${row.domain} is already set up.` };
  if (!input.isNew && !existing) return { ok: false, error: `${row.domain} isn't set up.` };
  try {
    await deps.save(row);
  } catch (error) {
    return { ok: false, error: `Saving ${row.domain} failed: ${errorText(error)}` };
  }
  await deps.audit({
    actorId: input.actorId,
    orgId: row.orgId,
    action: existing ? "sso.update" : "sso.add",
    before: existing ? asJson(existing) : null,
    after: asJson(row),
    details: { domain: row.domain },
  });
  return { ok: true, message: `${row.domain} is ${existing ? "updated" : "set up"}.` };
}

export async function removeSsoDomain(
  deps: SsoDeps,
  input: { domain: string; actorId: string },
): Promise<SsoResult> {
  const existing = await deps.get(input.domain);
  if (!existing) return { ok: false, error: `${input.domain} isn't set up.` };
  await deps.remove(input.domain);
  await deps.audit({
    actorId: input.actorId,
    orgId: existing.orgId,
    action: "sso.remove",
    before: asJson(existing),
    details: { domain: input.domain },
  });
  return {
    ok: true,
    message: `${input.domain} no longer signs in with SSO. People already in the team stay in it.`,
  };
}

/** The Supabase project ref, from its URL, for the set-up checklist. */
export function supabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".supabase.co") ? host.split(".")[0] : null;
  } catch {
    return null;
  }
}
