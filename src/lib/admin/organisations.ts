import "server-only";

import type Stripe from "stripe";

import { describeKey, getKeyPlans } from "@/lib/aws/apiKeys";
import { listUsagePlans } from "@/lib/aws/usagePlans";
import { planLabel } from "@/lib/billing/plan-name";
import { deriveSubscriptionRecord, priceMeta } from "@/lib/billing/subscription-record";
import type { OrgRole, ReviewStatus } from "@/lib/nav";
import { type AuditEntry, auditEntries } from "@/lib/review/queries";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/admin";
import { utcDate } from "@/lib/usage/sync";

import { type DriftField, driftFields, type StoredSubscriptionRow } from "./drift";
import {
  buildOrgRows,
  type OrgInput,
  type OrgListRow,
  type StripeSubSummary,
} from "./organisations-list";
import {
  KEY_COLUMNS,
  type KeyDbRow,
  SUBSCRIPTION_COLUMNS,
  type SubscriptionDbRow,
  toStoredRow,
} from "./rows";

// Reads for the admin organisation pages (ADM-01 to ADM-04). The service
// role is used throughout: every caller has already passed requireAdmin().

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

const PAGE = 1000;

/** Reads every row of a query, a page at a time (PostgREST caps each response). */
async function all<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  what: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await query(offset, offset + PAGE - 1);
    if (error) fail(what, error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

function summarise(sub: Stripe.Subscription): StripeSubSummary {
  const item = sub.items.data[0];
  const price = item?.price;
  const meta = priceMeta(price);
  const customer = typeof sub.customer === "string" ? null : sub.customer;
  const live = customer && !("deleted" in customer && customer.deleted) ? customer : null;
  return {
    record: deriveSubscriptionRecord(sub),
    planName: price ? planLabel(price) : "Unknown price",
    tier: meta.tier,
    interval: meta.interval ?? price?.recurring?.interval ?? null,
    customerName: live && "name" in live ? (live.name ?? null) : null,
    customerEmail: live && "email" in live ? (live.email ?? null) : null,
    created: new Date(sub.created * 1000),
  };
}

/** Every Stripe subscription, or null when Stripe isn't configured. */
async function allStripeSubscriptions(): Promise<StripeSubSummary[] | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const subs: StripeSubSummary[] = [];
  for await (const sub of stripe.subscriptions.list({
    status: "all",
    limit: 100,
    expand: ["data.customer"],
  })) {
    subs.push(summarise(sub));
  }
  return subs;
}

type OrgRow = {
  id: string;
  name: string;
  review_status: ReviewStatus;
  created_at: string;
  stripe_customer_id: string | null;
};

/** Usage in the last 30 days for each organisation's Bank Account Checker keys. */
async function checksLast30Days(): Promise<Map<string, number>> {
  const db = createServiceClient();
  const from = utcDate(new Date(), 30);
  const rows = await all(
    (a, b) =>
      db
        .from("usage_daily")
        .select("api_key_id, date, success, not_found, api_keys!inner (org_id, product)")
        .eq("api_keys.product", "bank_checker")
        .gte("date", from)
        .order("api_key_id")
        .order("date")
        .range(a, b)
        .returns<Array<{ success: number; not_found: number; api_keys: { org_id: string } }>>(),
    "reading recent usage",
  );
  const totals = new Map<string, number>();
  for (const row of rows) {
    const org = row.api_keys.org_id;
    totals.set(org, (totals.get(org) ?? 0) + row.success + row.not_found);
  }
  return totals;
}

export type OrganisationList = { rows: OrgListRow[]; stripeAvailable: boolean };

export async function listOrganisationRows(): Promise<OrganisationList> {
  const db = createServiceClient();
  const now = new Date().toISOString();
  const [orgs, subs, members, invites, stripe, checks] = await Promise.all([
    all(
      (a, b) =>
        db
          .from("organisations")
          .select("id, name, review_status, created_at, stripe_customer_id")
          .order("created_at")
          .range(a, b)
          .returns<OrgRow[]>(),
      "reading organisations",
    ),
    all(
      (a, b) =>
        db
          .from("subscriptions")
          .select(SUBSCRIPTION_COLUMNS)
          .order("created_at")
          .range(a, b)
          .returns<SubscriptionDbRow[]>(),
      "reading subscriptions",
    ),
    all(
      (a, b) =>
        db
          .from("memberships")
          .select("org_id, user_id, role")
          .order("user_id")
          .range(a, b)
          .returns<Array<{ org_id: string; user_id: string; role: OrgRole }>>(),
      "reading memberships",
    ),
    all(
      (a, b) =>
        db
          .from("invitations")
          .select("org_id, expires_at")
          .is("accepted_at", null)
          .is("revoked_at", null)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order("id")
          .range(a, b)
          .returns<Array<{ org_id: string }>>(),
      "reading invitations",
    ),
    allStripeSubscriptions().catch((error) => {
      console.error("listing Stripe subscriptions failed", error);
      return null;
    }),
    checksLast30Days(),
  ]);

  const owners = members.filter((m) => m.role === "owner");
  const ownerProfiles = owners.length
    ? await db
        .from("profiles")
        .select("id, email")
        .in(
          "id",
          owners.map((o) => o.user_id),
        )
        .returns<Array<{ id: string; email: string }>>()
    : { data: [], error: null };
  if (ownerProfiles.error) fail("reading owners", ownerProfiles.error);
  const emailOf = new Map((ownerProfiles.data ?? []).map((p) => [p.id, p.email]));

  const seats = new Map<string, number>();
  for (const m of members) seats.set(m.org_id, (seats.get(m.org_id) ?? 0) + 1);
  for (const i of invites) seats.set(i.org_id, (seats.get(i.org_id) ?? 0) + 1);

  const orgInputs: OrgInput[] = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    reviewStatus: o.review_status,
    createdAt: new Date(o.created_at),
    stripeCustomerId: o.stripe_customer_id,
  }));

  return {
    rows: buildOrgRows({
      orgs: orgInputs,
      stored: subs.map(toStoredRow),
      stripe,
      ownerEmails: new Map(
        owners.flatMap((o) => {
          const email = emailOf.get(o.user_id);
          return email ? [[o.org_id, email] as const] : [];
        }),
      ),
      seatsUsed: seats,
      checks30d: checks,
    }),
    stripeAvailable: stripe !== null,
  };
}

export type DetailMember = {
  userId: string;
  email: string;
  name: string | null;
  role: OrgRole;
  joinedAt: Date;
};

export type DetailInvite = {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
  sentAt: Date | null;
  expiresAt: Date | null;
};

export type DetailKey = {
  id: string;
  product: "bank_checker" | "eiscd";
  enabled: boolean;
  usagePlanId: string | null;
  disabledByAdmin: boolean;
  createdAt: Date;
  rotatedFrom: string | null;
  retireAt: Date | null;
  /** What API Gateway says; null when it couldn't be read. */
  aws: { exists: boolean; enabled: boolean; plans: string[] } | null;
};

export type DetailSubscription = {
  stored: StoredSubscriptionRow | null;
  stripe: StripeSubSummary | null;
  drift: DriftField[];
  /** The organisation's current subscription for its product. */
  current: boolean;
};

export type OrganisationDetail = {
  id: string;
  name: string;
  reviewStatus: ReviewStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  stripeCustomerId: string | null;
  allowExternalInvites: boolean;
  members: DetailMember[];
  invites: DetailInvite[];
  seats: { limit: number | null; members: number; pendingInvites: number };
  subscriptions: DetailSubscription[];
  stripeAvailable: boolean;
  keys: DetailKey[];
  usagePlanNames: Map<string, string>;
  history: AuditEntry[];
};

async function stripeSubscriptionsFor(customer: string): Promise<StripeSubSummary[] | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const subs: StripeSubSummary[] = [];
  try {
    for await (const sub of stripe.subscriptions.list({ customer, status: "all", limit: 100 })) {
      subs.push(summarise(sub));
    }
  } catch (error) {
    console.error("listing the customer's Stripe subscriptions failed", error);
    return null;
  }
  return subs;
}

async function awsState(keyId: string): Promise<DetailKey["aws"]> {
  try {
    const info = await describeKey(keyId);
    if (!info) return { exists: false, enabled: false, plans: [] };
    return { exists: true, enabled: info.enabled, plans: await getKeyPlans(keyId) };
  } catch (error) {
    console.error("reading the key from API Gateway failed", keyId, error);
    return null;
  }
}

export async function getOrganisationDetail(orgId: string): Promise<OrganisationDetail | null> {
  const db = createServiceClient();
  const org = await db
    .from("organisations")
    .select(
      "id, name, review_status, created_at, reviewed_at, review_note, stripe_customer_id, allow_external_invites",
    )
    .eq("id", orgId)
    .maybeSingle<
      OrgRow & {
        reviewed_at: string | null;
        review_note: string | null;
        allow_external_invites: boolean;
      }
    >();
  if (org.error) fail("reading the organisation", org.error);
  if (!org.data) return null;
  const o = org.data;

  const [members, invites, seats, subs, keys, history, stripe, plans] = await Promise.all([
    db
      .from("memberships")
      .select("user_id, role, joined_at")
      .eq("org_id", orgId)
      .returns<Array<{ user_id: string; role: OrgRole; joined_at: string }>>(),
    db
      .from("invitations")
      .select("id, email, role, created_at, sent_at, expires_at")
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at")
      .returns<
        Array<{
          id: string;
          email: string;
          role: string;
          created_at: string;
          sent_at: string | null;
          expires_at: string | null;
        }>
      >(),
    db.rpc("org_seat_usage", { p_org: orgId }),
    db
      .from("subscriptions")
      .select(SUBSCRIPTION_COLUMNS)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .returns<SubscriptionDbRow[]>(),
    db
      .from("api_keys")
      .select(`${KEY_COLUMNS}, disabled_by_admin`)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .returns<KeyDbRow[]>(),
    auditEntries({ orgId, limit: 20 }),
    o.stripe_customer_id ? stripeSubscriptionsFor(o.stripe_customer_id) : Promise.resolve(null),
    listUsagePlans().catch((error) => {
      console.error("listing usage plans failed", error);
      return [];
    }),
  ]);
  if (members.error) fail("reading the team", members.error);
  if (invites.error) fail("reading invites", invites.error);
  if (subs.error) fail("reading subscriptions", subs.error);
  if (keys.error) fail("reading keys", keys.error);

  const profiles = members.data.length
    ? await db
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in(
          "id",
          members.data.map((m) => m.user_id),
        )
        .returns<
          Array<{ id: string; email: string; first_name: string | null; last_name: string | null }>
        >()
    : { data: [], error: null };
  if (profiles.error) fail("reading the team's profiles", profiles.error);
  const profileOf = new Map((profiles.data ?? []).map((p) => [p.id, p]));
  const roleOrder: OrgRole[] = ["owner", "developer", "member"];

  const seatRow = (
    seats.data as Array<{
      seat_limit: number | null;
      members: number;
      pending_invites: number;
    }> | null
  )?.[0];

  // Every subscription on either side, current ones first (ADM-03).
  const stored = subs.data.map(toStoredRow);
  const stripeById = new Map((stripe ?? []).map((s) => [s.record.stripeSubscriptionId, s]));
  const currentIds = new Set<string>();
  for (const product of ["bank_checker", "eiscd"] as const) {
    const rows = stored.filter((r) => r.product === product);
    const pick = rows.find((r) => !r.expired) ?? rows[0];
    if (pick) currentIds.add(pick.stripeSubscriptionId);
  }
  const subscriptions: DetailSubscription[] = stored.map((row) => {
    const live = stripeById.get(row.stripeSubscriptionId) ?? null;
    return {
      stored: row,
      stripe: live,
      drift: live ? driftFields(row, live.record) : [],
      current: currentIds.has(row.stripeSubscriptionId),
    };
  });
  const storedIds = new Set(stored.map((r) => r.stripeSubscriptionId));
  for (const sub of stripe ?? []) {
    if (storedIds.has(sub.record.stripeSubscriptionId)) continue;
    subscriptions.push({ stored: null, stripe: sub, drift: [], current: false });
  }

  return {
    id: o.id,
    name: o.name,
    reviewStatus: o.review_status,
    createdAt: new Date(o.created_at),
    reviewedAt: o.reviewed_at ? new Date(o.reviewed_at) : null,
    reviewNote: o.review_note,
    stripeCustomerId: o.stripe_customer_id,
    allowExternalInvites: o.allow_external_invites,
    members: members.data
      .flatMap((m) => {
        const p = profileOf.get(m.user_id);
        return p
          ? [
              {
                userId: m.user_id,
                email: p.email,
                name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
                role: m.role,
                joinedAt: new Date(m.joined_at),
              },
            ]
          : [];
      })
      .sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)),
    invites: invites.data.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      createdAt: new Date(i.created_at),
      sentAt: i.sent_at ? new Date(i.sent_at) : null,
      expiresAt: i.expires_at ? new Date(i.expires_at) : null,
    })),
    seats: {
      limit: seatRow?.seat_limit ?? null,
      members: seatRow?.members ?? members.data.length,
      pendingInvites: seatRow?.pending_invites ?? invites.data.length,
    },
    subscriptions,
    stripeAvailable: stripe !== null,
    keys: await Promise.all(
      keys.data.map(async (k) => ({
        id: k.id,
        product: k.product,
        enabled: k.enabled,
        usagePlanId: k.usage_plan_id,
        disabledByAdmin: k.disabled_by_admin ?? false,
        createdAt: new Date(k.created_at),
        rotatedFrom: k.rotated_from,
        retireAt: k.retire_at ? new Date(k.retire_at) : null,
        aws: await awsState(k.id),
      })),
    ),
    usagePlanNames: new Map(plans.map((p) => [p.id, p.name])),
    history,
  };
}
