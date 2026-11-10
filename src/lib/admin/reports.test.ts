import { describe, expect, it } from "vitest";

import {
  cancellationReasons,
  lastMonths,
  median,
  monthlyAmount,
  monthlyRows,
  type ReportOrg,
  revenueByPlan,
  trialConversion,
} from "./reports";

const d = (iso: string) => new Date(iso);

const org = (overrides: Partial<ReportOrg> = {}): ReportOrg => ({
  createdAt: d("2026-10-01T09:00:00Z"),
  reviewStatus: "approved",
  reviewedAt: d("2026-10-01T13:00:00Z"),
  autoApproved: false,
  endedAt: null,
  cancellationReason: null,
  ...overrides,
});

describe("business dashboard (ADM-14)", () => {
  it("lists the last months, oldest first", () => {
    expect(lastMonths(d("2026-11-10T00:00:00Z"), 3)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(lastMonths(d("2026-01-15T00:00:00Z"), 2)).toEqual(["2025-12", "2026-01"]);
  });

  it("takes the median", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("counts each month's sign-ups, reviews, time to approve and cancellations", () => {
    const [oct, nov] = monthlyRows({
      months: ["2026-10", "2026-11"],
      signUps: [d("2026-10-02T00:00:00Z"), d("2026-11-03T00:00:00Z"), d("2026-11-04T00:00:00Z")],
      orgs: [
        org(),
        org({ reviewedAt: d("2026-10-02T09:00:00Z") }),
        org({ autoApproved: true, reviewedAt: d("2026-10-01T09:00:00Z") }),
        org({
          createdAt: d("2026-11-01T00:00:00Z"),
          reviewStatus: "rejected",
          reviewedAt: d("2026-11-01T02:00:00Z"),
        }),
        org({ endedAt: d("2026-11-20T00:00:00Z"), autoApproved: true }),
      ],
      decisions: [
        { at: d("2026-10-01T13:00:00Z"), action: "approve" },
        { at: d("2026-10-02T09:00:00Z"), action: "approve" },
        { at: d("2026-11-01T02:00:00Z"), action: "decline" },
        { at: d("2026-11-09T02:00:00Z"), action: "expire" },
      ],
    });
    expect(oct).toMatchObject({
      signUps: 1,
      newOrganisations: 4,
      approved: 2,
      declined: 0,
      cancellations: 0,
    });
    // 4 hours and 24 hours: the automatic approval doesn't count.
    expect(oct.medianHoursToApprove).toBe(14);
    expect(nov).toMatchObject({
      signUps: 2,
      newOrganisations: 1,
      approved: 0,
      declined: 2,
      cancellations: 1,
      medianHoursToApprove: null,
    });
  });

  it("works out trial-to-paid conversion from finished trials", () => {
    const sub = { product: "bank_checker" as const, trialEnd: d("2026-10-01T00:00:00Z") };
    expect(
      trialConversion([
        { ...sub, status: "active", trialing: false, expired: false },
        { ...sub, status: "active", trialing: false, expired: false },
        { ...sub, status: "canceled", trialing: false, expired: true },
        { ...sub, status: "trialing", trialing: true, expired: false },
        { ...sub, trialEnd: null, status: "active", trialing: false, expired: false },
      ]),
    ).toEqual({ converted: 2, lost: 1, rate: 2 / 3 });
    expect(trialConversion([]).rate).toBeNull();
  });

  it("groups cancellation reasons", () => {
    expect(
      cancellationReasons(
        [
          org({ endedAt: d("2026-11-01T00:00:00Z"), cancellationReason: "Too expensive" }),
          org({ endedAt: d("2026-11-02T00:00:00Z"), cancellationReason: "Too expensive" }),
          org({ endedAt: d("2026-11-03T00:00:00Z") }),
          org({ endedAt: d("2025-01-03T00:00:00Z"), cancellationReason: "Old" }),
        ],
        d("2026-06-01T00:00:00Z"),
      ),
    ).toEqual([
      { reason: "Too expensive", count: 2 },
      { reason: "No reason given", count: 1 },
    ]);
  });

  it("normalises recurring revenue to a month and groups it by plan", () => {
    const line = {
      planName: "Starter Plan",
      unitAmount: 3700,
      quantity: 1,
      interval: "month",
      intervalCount: 1,
      currency: "gbp",
    };
    expect(monthlyAmount({ ...line, interval: "year", unitAmount: 36000 })).toBe(3000);
    expect(monthlyAmount({ ...line, unitAmount: null })).toBe(0);
    expect(
      revenueByPlan([
        line,
        line,
        { ...line, planName: "Professional Plan", interval: "year", unitAmount: 212000 },
      ]),
    ).toEqual([
      { planName: "Professional Plan", currency: "gbp", subscriptions: 1, monthly: 17667 },
      { planName: "Starter Plan", currency: "gbp", subscriptions: 2, monthly: 7400 },
    ]);
  });
});
