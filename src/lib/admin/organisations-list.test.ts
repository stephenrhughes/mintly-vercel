import { describe, expect, it } from "vitest";

import { subscription } from "@/lib/billing/fixtures";
import { deriveSubscriptionRecord } from "@/lib/billing/subscription-record";

import type { StoredSubscriptionRow } from "./drift";
import {
  buildOrgRows,
  type BuildInput,
  filterAndSort,
  type OrgListRow,
  overviewCounts,
  type StripeSubSummary,
} from "./organisations-list";

const stripeSub = (overrides: Parameters<typeof subscription>[0] = {}): StripeSubSummary => ({
  record: deriveSubscriptionRecord(subscription(overrides)),
  planName: "Starter Plan",
  tier: "starter",
  interval: "monthly",
  customerName: "Acme Ltd",
  customerEmail: "owner@acme.co.uk",
  created: new Date("2026-01-01T00:00:00Z"),
});

function storedFrom(sub: StripeSubSummary, orgId = "org_1"): StoredSubscriptionRow {
  const r = sub.record;
  return {
    orgId,
    product: r.product,
    stripeSubscriptionId: r.stripeSubscriptionId,
    stripeSubscriptionItemId: r.stripeSubscriptionItemId,
    stripePriceId: r.stripePriceId,
    status: r.status,
    trialing: r.trialing,
    trialEnd: r.trialEnd,
    currentPeriodEnd: r.currentPeriodEnd,
    cancelAt: r.cancelAt,
    expired: r.expired,
    maxTeamSize: r.maxTeamSize,
    extraUsers: r.extraUsers,
    usagePlanId: r.usagePlanId,
    apiKeyId: "key_1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedFromStripeAt: null,
  };
}

function input(overrides: Partial<BuildInput> = {}): BuildInput {
  const sub = stripeSub();
  return {
    orgs: [
      {
        id: "org_1",
        name: "Acme",
        reviewStatus: "approved",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        stripeCustomerId: "cus_1",
      },
    ],
    stored: [storedFrom(sub)],
    stripe: [sub],
    ownerEmails: new Map([["org_1", "owner@acme.co.uk"]]),
    seatsUsed: new Map([["org_1", 1]]),
    checks30d: new Map([["org_1", 10]]),
    ...overrides,
  };
}

describe("buildOrgRows (ADM-01, ADM-02)", () => {
  it("merges the database row with Stripe", () => {
    const [row] = buildOrgRows(input());
    expect(row).toMatchObject({
      id: "org_1",
      name: "Acme",
      ownerEmail: "owner@acme.co.uk",
      planName: "Starter Plan",
      stripeStatus: "active",
      storedStatus: "active",
      source: "both",
      driftCount: 0,
      seatLimit: 1,
      allowance: 250,
    });
  });

  it("counts drift between the stored row and Stripe", () => {
    const sub = stripeSub({ status: "past_due" });
    const [row] = buildOrgRows(input({ stripe: [sub], stored: [storedFrom(stripeSub())] }));
    expect(row.driftCount).toBe(1);
    expect(row.stripeStatus).toBe("past_due");
  });

  it("counts a stored subscription Stripe doesn't have, and a live one only Stripe has", () => {
    const other = stripeSub({ id: "sub_2" });
    const [row] = buildOrgRows(input({ stripe: [other] }));
    expect(row.driftCount).toBe(2);
  });

  it("labels Stripe customers with no organisation here", () => {
    const stray = stripeSub({ id: "sub_9", customer: "cus_9" });
    const rows = buildOrgRows(input({ stripe: [stripeSub(), stray] }));
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ id: null, source: "stripe", name: "Acme Ltd" });
  });

  it("works without Stripe, from the database alone", () => {
    const [row] = buildOrgRows(input({ stripe: null }));
    expect(row).toMatchObject({ source: "database", driftCount: 0, storedStatus: "active" });
  });
});

function row(overrides: Partial<OrgListRow>): OrgListRow {
  return { ...buildOrgRows(input())[0], ...overrides };
}

describe("filterAndSort (ADM-02)", () => {
  const rows = [
    row({ id: "a", name: "Beta", stripeStatus: "trialing", trialing: true }),
    row({ id: "b", name: "alpha", stripeStatus: "past_due", driftCount: 2 }),
    row({ id: "c", name: "Gamma", cancelAt: new Date(), seatsUsed: 3, seatLimit: 1 }),
    row({ id: "d", name: "Delta", checks30d: 240, reviewStatus: "suspended" }),
  ];
  const ids = (list: OrgListRow[]) => list.map((r) => r.id);

  it("sorts by name, ignoring case, either way", () => {
    expect(ids(filterAndSort(rows, {}))).toEqual(["b", "a", "d", "c"]);
    expect(ids(filterAndSort(rows, { desc: true }))).toEqual(["c", "d", "a", "b"]);
  });

  it("filters by status and by what needs attention", () => {
    expect(ids(filterAndSort(rows, { filter: "trialing" }))).toEqual(["a"]);
    expect(ids(filterAndSort(rows, { filter: "past_due" }))).toEqual(["b"]);
    expect(ids(filterAndSort(rows, { filter: "drift" }))).toEqual(["b"]);
    expect(ids(filterAndSort(rows, { filter: "cancelling" }))).toEqual(["c"]);
    expect(ids(filterAndSort(rows, { filter: "over_seats" }))).toEqual(["c"]);
    expect(ids(filterAndSort(rows, { filter: "over_quota" }))).toEqual(["d"]);
    expect(ids(filterAndSort(rows, { filter: "suspended" }))).toEqual(["d"]);
  });

  it("searches names, emails and Stripe IDs", () => {
    expect(ids(filterAndSort(rows, { q: "GAM" }))).toEqual(["c"]);
    expect(filterAndSort(rows, { q: "cus_1" })).toHaveLength(4);
    expect(filterAndSort(rows, { q: "nothing" })).toHaveLength(0);
  });
});

describe("overviewCounts (plan §6.8)", () => {
  it("counts by status and lists trials ending within 7 days", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const soon = new Date("2026-03-04T00:00:00Z");
    const later = new Date("2026-03-20T00:00:00Z");
    const counts = overviewCounts(
      [
        row({ id: "a", stripeStatus: "trialing", trialing: true, trialEnd: soon }),
        row({ id: "b", stripeStatus: "trialing", trialing: true, trialEnd: later }),
        row({ id: "c", stripeStatus: "past_due", driftCount: 1 }),
      ],
      now,
    );
    expect(counts.byStatus).toMatchObject({ trialing: 2, past_due: 1, active: 0 });
    expect(counts.drift).toBe(1);
    expect(counts.trialsEndingSoon.map((r) => r.id)).toEqual(["a"]);
  });
});
