import "server-only";

import type { ReviewStatus } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/admin";

import type { SignupSignals } from "./decide";

// Reads for the admin review pages (plan §6.11, APPR-04). These use the
// service role because review notes and sign-up signals are never readable
// with a user session; every caller has already passed requireAdmin().

export type ReviewListItem = {
  id: string;
  name: string;
  status: ReviewStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  signals: Partial<SignupSignals>;
};

type OrgRow = {
  id: string;
  name: string;
  review_status: ReviewStatus;
  created_at: string;
  reviewed_at: string | null;
  signup_signals: Partial<SignupSignals> | null;
};

const toItem = (row: OrgRow): ReviewListItem => ({
  id: row.id,
  name: row.name,
  status: row.review_status,
  createdAt: new Date(row.created_at),
  reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
  signals: row.signup_signals ?? {},
});

const ORG_COLUMNS = "id, name, review_status, created_at, reviewed_at, signup_signals";

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

/** The queue: pending reviews, oldest first. */
export async function listPendingReviews(): Promise<ReviewListItem[]> {
  const { data, error } = await createServiceClient()
    .from("organisations")
    .select(ORG_COLUMNS)
    .eq("review_status", "pending_review")
    .order("created_at", { ascending: true })
    .returns<OrgRow[]>();
  if (error) fail("reading the review queue", error);
  return data.map(toItem);
}

export async function listSuspended(): Promise<ReviewListItem[]> {
  const { data, error } = await createServiceClient()
    .from("organisations")
    .select(ORG_COLUMNS)
    .eq("review_status", "suspended")
    .order("reviewed_at", { ascending: false })
    .returns<OrgRow[]>();
  if (error) fail("reading suspended organisations", error);
  return data.map(toItem);
}

/** For the admin overview: how many are waiting, and since when (plan §6.8). */
export async function pendingSummary(): Promise<{ count: number; oldest: Date | null }> {
  const { data, error, count } = await createServiceClient()
    .from("organisations")
    .select("created_at", { count: "exact" })
    .eq("review_status", "pending_review")
    .order("created_at", { ascending: true })
    .limit(1)
    .returns<Array<{ created_at: string }>>();
  if (error) fail("counting pending reviews", error);
  return { count: count ?? 0, oldest: data[0] ? new Date(data[0].created_at) : null };
}

export type AuditEntry = {
  id: number;
  at: Date;
  action: string;
  actorEmail: string | null;
  orgId: string | null;
  orgName: string | null;
  details: Record<string, unknown>;
};

/** Audit entries, newest first, with actor emails and organisation names (ADM-07). */
export async function auditEntries(filter: {
  orgId?: string;
  prefix?: string;
  limit: number;
}): Promise<AuditEntry[]> {
  const db = createServiceClient();
  let query = db
    .from("admin_audit")
    .select("id, at, action, actor_id, target_org_id, details")
    .order("at", { ascending: false })
    .limit(filter.limit);
  if (filter.orgId) query = query.eq("target_org_id", filter.orgId);
  if (filter.prefix) query = query.like("action", `${filter.prefix}%`);
  const { data, error } = await query.returns<
    Array<{
      id: number;
      at: string;
      action: string;
      actor_id: string | null;
      target_org_id: string | null;
      details: Record<string, unknown>;
    }>
  >();
  if (error) fail("reading the audit log", error);

  const actorIds = [...new Set(data.flatMap((row) => (row.actor_id ? [row.actor_id] : [])))];
  const orgIds = [
    ...new Set(data.flatMap((row) => (row.target_org_id ? [row.target_org_id] : []))),
  ];
  const [actors, orgs] = await Promise.all([
    actorIds.length
      ? db
          .from("profiles")
          .select("id, email")
          .in("id", actorIds)
          .returns<Array<{ id: string; email: string }>>()
      : Promise.resolve({ data: [], error: null }),
    orgIds.length
      ? db
          .from("organisations")
          .select("id, name")
          .in("id", orgIds)
          .returns<Array<{ id: string; name: string }>>()
      : Promise.resolve({ data: [], error: null }),
  ]);
  const emailOf = new Map((actors.data ?? []).map((a) => [a.id, a.email]));
  const nameOf = new Map((orgs.data ?? []).map((o) => [o.id, o.name]));

  return data.map((row) => ({
    id: row.id,
    at: new Date(row.at),
    action: row.action,
    actorEmail: row.actor_id ? (emailOf.get(row.actor_id) ?? null) : null,
    orgId: row.target_org_id,
    orgName: row.target_org_id ? (nameOf.get(row.target_org_id) ?? null) : null,
    details: row.details ?? {},
  }));
}

export const recentDecisions = (limit = 15) => auditEntries({ prefix: "review.", limit });

export type RelatedTrial = {
  id: string;
  name: string;
  status: ReviewStatus;
  createdAt: Date;
  matchedOn: string[];
};

export type ReviewDetail = ReviewListItem & {
  reviewNote: string | null;
  owner: { email: string; name: string | null; phone: string | null } | null;
  subscription: {
    stripeSubscriptionId: string;
    status: string;
    trialEnd: Date | null;
    priceId: string;
  } | null;
  related: RelatedTrial[];
  history: AuditEntry[];
};

/**
 * One organisation's review: its signals, earlier trials from the same
 * domain, email or IP (the main abuse pattern is repeated trials, APPR-04),
 * and its decision history.
 */
export async function getReview(orgId: string): Promise<ReviewDetail | null> {
  const db = createServiceClient();
  const { data: row, error } = await db
    .from("organisations")
    .select(`${ORG_COLUMNS}, review_note`)
    .eq("id", orgId)
    .maybeSingle<OrgRow & { review_note: string | null }>();
  if (error) fail("reading the organisation", error);
  if (!row) return null;
  const item = toItem(row);

  const [ownerRow, sub, history] = await Promise.all([
    db
      .from("memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "owner")
      .maybeSingle<{ user_id: string }>(),
    db
      .from("subscriptions")
      .select("stripe_subscription_id, status, trial_end, stripe_price_id")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        stripe_subscription_id: string;
        status: string;
        trial_end: string | null;
        stripe_price_id: string;
      }>(),
    auditEntries({ orgId, limit: 50 }),
  ]);

  let owner: ReviewDetail["owner"] = null;
  if (ownerRow.data) {
    const { data: profile } = await db
      .from("profiles")
      .select("email, first_name, last_name, phone")
      .eq("id", ownerRow.data.user_id)
      .maybeSingle<{
        email: string;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
      }>();
    if (profile) {
      owner = {
        email: profile.email,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null,
        phone: profile.phone,
      };
    }
  }

  return {
    ...item,
    reviewNote: row.review_note,
    owner,
    subscription: sub.data
      ? {
          stripeSubscriptionId: sub.data.stripe_subscription_id,
          status: sub.data.status,
          trialEnd: sub.data.trial_end ? new Date(sub.data.trial_end) : null,
          priceId: sub.data.stripe_price_id,
        }
      : null,
    related: await relatedTrials(item),
    history,
  };
}

async function relatedTrials(item: ReviewListItem): Promise<RelatedTrial[]> {
  const db = createServiceClient();
  const matches = new Map<string, RelatedTrial>();
  const checks: Array<[string, keyof SignupSignals, string | null | undefined]> = [
    ["domain", "domain", item.signals.domain],
    ["email", "email", item.signals.email],
    ["IP address", "ip_hash", item.signals.ip_hash],
  ];
  for (const [label, key, value] of checks) {
    if (!value) continue;
    const { data, error } = await db
      .from("organisations")
      .select("id, name, review_status, created_at")
      .eq(`signup_signals->>${key}`, value)
      .neq("id", item.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<
        Array<{ id: string; name: string; review_status: ReviewStatus; created_at: string }>
      >();
    if (error) fail("finding related trials", error);
    for (const org of data) {
      const existing = matches.get(org.id);
      if (existing) existing.matchedOn.push(label);
      else {
        matches.set(org.id, {
          id: org.id,
          name: org.name,
          status: org.review_status,
          createdAt: new Date(org.created_at),
          matchedOn: [label],
        });
      }
    }
  }
  return [...matches.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export type ListedDomain = {
  domain: string;
  reason: string | null;
  addedAt: Date;
  addedBy: string | null;
};

export async function listDomains(): Promise<{ trusted: ListedDomain[]; blocked: ListedDomain[] }> {
  const db = createServiceClient();
  type Row = { domain: string; reason: string | null; added_at: string; added_by: string | null };
  const [trusted, blocked] = await Promise.all([
    db
      .from("trusted_domains")
      .select("domain, reason, added_at, added_by")
      .order("domain")
      .returns<Row[]>(),
    db
      .from("blocked_domains")
      .select("domain, reason, added_at, added_by")
      .order("domain")
      .returns<Row[]>(),
  ]);
  if (trusted.error) fail("reading trusted domains", trusted.error);
  if (blocked.error) fail("reading blocked domains", blocked.error);

  const ids = [
    ...new Set([...trusted.data, ...blocked.data].flatMap((r) => (r.added_by ? [r.added_by] : []))),
  ];
  const { data: people } = ids.length
    ? await db
        .from("profiles")
        .select("id, email")
        .in("id", ids)
        .returns<Array<{ id: string; email: string }>>()
    : { data: [] as Array<{ id: string; email: string }> };
  const emailOf = new Map((people ?? []).map((p) => [p.id, p.email]));
  const map = (row: Row): ListedDomain => ({
    domain: row.domain,
    reason: row.reason,
    addedAt: new Date(row.added_at),
    addedBy: row.added_by ? (emailOf.get(row.added_by) ?? null) : null,
  });
  return { trusted: trusted.data.map(map), blocked: blocked.data.map(map) };
}
