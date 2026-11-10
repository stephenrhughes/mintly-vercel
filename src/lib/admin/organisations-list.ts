// The admin organisations list (ADM-01, ADM-02) and overview counts (plan
// §6.8), as pure functions over what organisations.ts reads: the database
// rows merged with every Stripe subscription, so a customer found on only
// one side still appears, labelled.

import { isPlanTier, PLANS } from "@/lib/billing/plans";
import { seatLimit } from "@/lib/billing/seats";
import {
  isEndedStatus,
  isLiveStatus,
  type Product,
  type SubscriptionRecord,
} from "@/lib/billing/subscription-record";
import type { ReviewStatus } from "@/lib/nav";

import { driftFields, type StoredSubscriptionRow } from "./drift";

export type OrgInput = {
  id: string;
  name: string;
  reviewStatus: ReviewStatus;
  createdAt: Date;
  stripeCustomerId: string | null;
};

/** A Stripe subscription, reduced to what the list needs. */
export type StripeSubSummary = {
  record: SubscriptionRecord;
  planName: string;
  tier: string | null;
  interval: string | null;
  customerName: string | null;
  customerEmail: string | null;
  created: Date;
};

export type OrgListRow = {
  /** Null for a Stripe customer with no organisation here. */
  id: string | null;
  name: string;
  reviewStatus: ReviewStatus | null;
  createdAt: Date | null;
  ownerEmail: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  product: Product | null;
  planName: string | null;
  interval: string | null;
  stripeStatus: string | null;
  storedStatus: string | null;
  trialing: boolean;
  trialEnd: Date | null;
  periodEnd: Date | null;
  cancelAt: Date | null;
  expired: boolean;
  extraUsers: number;
  seatsUsed: number;
  seatLimit: number | null;
  driftCount: number;
  /** Where the organisation's subscription was found. */
  source: "both" | "database" | "stripe";
  /** Bank Account Checker checks in the last 30 days. */
  checks30d: number;
  /** The plan's monthly allowance, when it is a self-serve tier. */
  allowance: number | null;
};

export type BuildInput = {
  orgs: OrgInput[];
  stored: StoredSubscriptionRow[];
  /** Every Stripe subscription; null when Stripe isn't available. */
  stripe: StripeSubSummary[] | null;
  ownerEmails: Map<string, string>;
  seatsUsed: Map<string, number>;
  checks30d: Map<string, number>;
};

const productOrder = (p: Product) => (p === "bank_checker" ? 0 : 1);

/** The subscription a row shows: live Bank Account Checker first, then the newest. */
function pickStored(rows: StoredSubscriptionRow[]): StoredSubscriptionRow | null {
  return (
    [...rows].sort((a, b) => {
      if (a.expired !== b.expired) return a.expired ? 1 : -1;
      if (a.product !== b.product) return productOrder(a.product) - productOrder(b.product);
      return b.createdAt.getTime() - a.createdAt.getTime();
    })[0] ?? null
  );
}

function pickStripe(subs: StripeSubSummary[]): StripeSubSummary | null {
  return (
    [...subs].sort((a, b) => {
      const al = isLiveStatus(a.record.status);
      const bl = isLiveStatus(b.record.status);
      if (al !== bl) return al ? -1 : 1;
      if (a.record.product !== b.record.product) {
        return productOrder(a.record.product) - productOrder(b.record.product);
      }
      return b.created.getTime() - a.created.getTime();
    })[0] ?? null
  );
}

/** How many things disagree between the database and Stripe for one organisation. */
export function orgDriftCount(stored: StoredSubscriptionRow[], stripe: StripeSubSummary[]): number {
  const byId = new Map(stripe.map((s) => [s.record.stripeSubscriptionId, s]));
  let count = 0;
  for (const row of stored) {
    const live = byId.get(row.stripeSubscriptionId);
    count += live ? driftFields(row, live.record).length : 1;
  }
  const storedIds = new Set(stored.map((r) => r.stripeSubscriptionId));
  for (const sub of stripe) {
    if (!storedIds.has(sub.record.stripeSubscriptionId) && isLiveStatus(sub.record.status)) count++;
  }
  return count;
}

function allowanceFor(product: Product | null, tier: string | null): number | null {
  if (product !== "bank_checker" || !isPlanTier(tier)) return null;
  return PLANS[tier].includedRequestsCount;
}

export function buildOrgRows(input: BuildInput): OrgListRow[] {
  const storedByOrg = new Map<string, StoredSubscriptionRow[]>();
  for (const row of input.stored) {
    storedByOrg.set(row.orgId, [...(storedByOrg.get(row.orgId) ?? []), row]);
  }
  const stripeByCustomer = new Map<string, StripeSubSummary[]>();
  for (const sub of input.stripe ?? []) {
    const id = sub.record.stripeCustomerId;
    stripeByCustomer.set(id, [...(stripeByCustomer.get(id) ?? []), sub]);
  }
  const stripeById = new Map((input.stripe ?? []).map((s) => [s.record.stripeSubscriptionId, s]));

  const rows: OrgListRow[] = [];
  const seenCustomers = new Set<string>();
  for (const org of input.orgs) {
    const stored = storedByOrg.get(org.id) ?? [];
    const stripeSubs = org.stripeCustomerId
      ? (stripeByCustomer.get(org.stripeCustomerId) ?? [])
      : [];
    if (org.stripeCustomerId) seenCustomers.add(org.stripeCustomerId);

    const pick = pickStored(stored);
    const live = pick
      ? (stripeById.get(pick.stripeSubscriptionId) ?? null)
      : pickStripe(stripeSubs);
    const record = live?.record ?? null;
    const maxTeamSize = record?.maxTeamSize ?? pick?.maxTeamSize ?? null;
    const extraUsers = record?.extraUsers ?? pick?.extraUsers ?? 0;
    const product = record?.product ?? pick?.product ?? null;

    rows.push({
      id: org.id,
      name: org.name,
      reviewStatus: org.reviewStatus,
      createdAt: org.createdAt,
      ownerEmail: input.ownerEmails.get(org.id) ?? null,
      stripeCustomerId: org.stripeCustomerId,
      stripeSubscriptionId: record?.stripeSubscriptionId ?? pick?.stripeSubscriptionId ?? null,
      product,
      planName: live?.planName ?? null,
      interval: live?.interval ?? null,
      stripeStatus: record?.status ?? null,
      storedStatus: pick?.status ?? null,
      trialing: record?.trialing ?? pick?.trialing ?? false,
      trialEnd: record?.trialEnd ?? pick?.trialEnd ?? null,
      periodEnd: record?.currentPeriodEnd ?? pick?.currentPeriodEnd ?? null,
      cancelAt: record?.cancelAt ?? pick?.cancelAt ?? null,
      expired: record?.expired ?? pick?.expired ?? false,
      extraUsers,
      seatsUsed: input.seatsUsed.get(org.id) ?? 0,
      seatLimit: seatLimit({ maxTeamSize, extraUsers }),
      driftCount: input.stripe ? orgDriftCount(stored, stripeSubs) : 0,
      source: pick && live ? "both" : pick ? "database" : live ? "stripe" : "database",
      checks30d: input.checks30d.get(org.id) ?? 0,
      allowance: allowanceFor(product, live?.tier ?? null),
    });
  }

  // Stripe customers with no organisation here (ADM-01).
  for (const [customer, subs] of stripeByCustomer) {
    if (seenCustomers.has(customer)) continue;
    const live = pickStripe(subs);
    if (!live) continue;
    const r = live.record;
    rows.push({
      id: null,
      name: live.customerName ?? live.customerEmail ?? customer,
      reviewStatus: null,
      createdAt: live.created,
      ownerEmail: live.customerEmail,
      stripeCustomerId: customer,
      stripeSubscriptionId: r.stripeSubscriptionId,
      product: r.product,
      planName: live.planName,
      interval: live.interval,
      stripeStatus: r.status,
      storedStatus: null,
      trialing: r.trialing,
      trialEnd: r.trialEnd,
      periodEnd: r.currentPeriodEnd,
      cancelAt: r.cancelAt,
      expired: r.expired,
      extraUsers: r.extraUsers,
      seatsUsed: 0,
      seatLimit: seatLimit({ maxTeamSize: r.maxTeamSize, extraUsers: r.extraUsers }),
      driftCount: subs.filter((s) => isLiveStatus(s.record.status)).length,
      source: "stripe",
      checks30d: 0,
      allowance: null,
    });
  }
  return rows;
}

export const ORG_FILTERS = {
  all: "All",
  trialing: "Trialing",
  active: "Active",
  cancelling: "Cancelling",
  past_due: "Past due",
  expired: "Expired",
  drift: "Needs attention (drift)",
  pending_review: "Pending review",
  suspended: "Suspended",
  over_seats: "Over seat limit",
  over_quota: "Over 80% of allowance",
  stripe_only: "Only in Stripe",
} as const;

export type OrgFilter = keyof typeof ORG_FILTERS;

export const ORG_SORTS = {
  name: "Name",
  created: "Created",
  renewal: "Trial end or renewal",
  drift: "Drift",
  usage: "Usage",
} as const;

export type OrgSort = keyof typeof ORG_SORTS;

export const isOrgFilter = (v: unknown): v is OrgFilter =>
  typeof v === "string" && Object.hasOwn(ORG_FILTERS, v);
export const isOrgSort = (v: unknown): v is OrgSort =>
  typeof v === "string" && Object.hasOwn(ORG_SORTS, v);

/** The status a row shows: Stripe's when known, else the stored one. */
export const rowStatus = (row: OrgListRow) => row.stripeStatus ?? row.storedStatus;

export function isCancelling(row: OrgListRow): boolean {
  return Boolean(row.cancelAt) && !row.expired;
}

export function isOverSeats(row: OrgListRow): boolean {
  return row.seatLimit !== null && row.seatsUsed > row.seatLimit;
}

/** Over 80% of the monthly allowance in the last 30 days (plan §6.8). */
export function isOverQuota(row: OrgListRow): boolean {
  return row.allowance !== null && !row.expired && row.checks30d > row.allowance * 0.8;
}

export function matchesFilter(row: OrgListRow, filter: OrgFilter): boolean {
  const status = rowStatus(row);
  switch (filter) {
    case "all":
      return true;
    case "trialing":
      return status === "trialing";
    case "active":
      return status === "active";
    case "cancelling":
      return isCancelling(row);
    case "past_due":
      return status === "past_due";
    case "expired":
      return row.expired || (status !== null && isEndedStatus(status));
    case "drift":
      return row.driftCount > 0;
    case "pending_review":
      return row.reviewStatus === "pending_review";
    case "suspended":
      return row.reviewStatus === "suspended";
    case "over_seats":
      return isOverSeats(row);
    case "over_quota":
      return isOverQuota(row);
    case "stripe_only":
      return row.source === "stripe";
  }
}

/** The next date that matters: the trial end while trialing, else the renewal. */
export const nextDate = (row: OrgListRow) => (row.trialing ? row.trialEnd : row.periodEnd);

export function filterAndSort(
  rows: OrgListRow[],
  options: { q?: string; filter?: OrgFilter; sort?: OrgSort; desc?: boolean },
): OrgListRow[] {
  const q = options.q?.trim().toLowerCase() ?? "";
  const filter = options.filter ?? "all";
  const sort = options.sort ?? "name";
  const filtered = rows.filter(
    (row) =>
      matchesFilter(row, filter) &&
      (!q ||
        [row.name, row.ownerEmail, row.stripeCustomerId, row.stripeSubscriptionId, row.id]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))),
  );

  const time = (d: Date | null) => d?.getTime() ?? Number.POSITIVE_INFINITY;
  const compare: Record<OrgSort, (a: OrgListRow, b: OrgListRow) => number> = {
    name: (a, b) => a.name.localeCompare(b.name, "en-GB", { sensitivity: "base" }),
    created: (a, b) => time(a.createdAt) - time(b.createdAt),
    renewal: (a, b) => time(nextDate(a)) - time(nextDate(b)),
    drift: (a, b) => a.driftCount - b.driftCount,
    usage: (a, b) => a.checks30d - b.checks30d,
  };
  const sorted = filtered.sort(compare[sort]);
  return options.desc ? sorted.reverse() : sorted;
}

export type OverviewCounts = {
  byStatus: Record<"trialing" | "active" | "past_due" | "cancelling" | "expired", number>;
  pendingReview: number;
  suspended: number;
  drift: number;
  overSeats: number;
  overQuota: number;
  stripeOnly: number;
  /** Trials ending within 7 days, soonest first. */
  trialsEndingSoon: OrgListRow[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function overviewCounts(rows: OrgListRow[], now: Date): OverviewCounts {
  const count = (filter: OrgFilter) => rows.filter((row) => matchesFilter(row, filter)).length;
  return {
    byStatus: {
      trialing: count("trialing"),
      active: count("active"),
      past_due: count("past_due"),
      cancelling: count("cancelling"),
      expired: count("expired"),
    },
    pendingReview: count("pending_review"),
    suspended: count("suspended"),
    drift: count("drift"),
    overSeats: count("over_seats"),
    overQuota: count("over_quota"),
    stripeOnly: count("stripe_only"),
    trialsEndingSoon: rows
      .filter(
        (row) =>
          rowStatus(row) === "trialing" &&
          row.trialEnd &&
          row.trialEnd.getTime() >= now.getTime() &&
          row.trialEnd.getTime() - now.getTime() <= WEEK_MS,
      )
      .sort((a, b) => (a.trialEnd?.getTime() ?? 0) - (b.trialEnd?.getTime() ?? 0)),
  };
}
