import { describe, expect, it } from "vitest";

import { isBillingInterval, isPlanTier, PLAN_TIERS, PLANS } from "./plans";

// Every plan states its facts twice: strings for the cards and numbers to
// compute with. Ported from mintly-web plans.test.js.
const pounds = (text: string) => Number(text.replace(/[£,]/g, ""));
const pence = (text: string) => Number(text.replace(/p$/, ""));
const count = (text: string) => Number(text.replace(/,/g, ""));

describe("plan strings and numbers agree", () => {
  it.each(Object.values(PLANS).map((plan) => [plan.name, plan] as const))("%s", (_name, plan) => {
    expect(plan.monthlyPriceGbp).toBe(pounds(plan.monthlyPrice));
    expect(plan.annualPriceGbp).toBe(pounds(plan.annualPrice));
    expect(plan.includedRequestsCount).toBe(count(plan.includedRequests));
    expect(plan.overagePence).toBe(pence(plan.pricePerRequest));
  });

  it("matches the seat count quoted on each card", () => {
    expect(PLANS.starter.includedUsers).toBe("Single user");
    expect(PLANS.starter.maxUsers).toBe(1);
    expect(PLANS.standardPlus.includedUsers).toBe(`${PLANS.standardPlus.maxUsers} users`);
    expect(PLANS.professional.includedUsers).toBe(`${PLANS.professional.maxUsers} users`);
  });

  it("keys each plan by its own tier, in ascending order of allowance", () => {
    for (const tier of PLAN_TIERS) expect(PLANS[tier].tier).toBe(tier);
    const allowances = PLAN_TIERS.map((tier) => PLANS[tier].includedRequestsCount);
    expect(allowances).toEqual([...allowances].sort((a, b) => a - b));
  });
});

describe("isPlanTier", () => {
  it("accepts only real tiers", () => {
    expect(isPlanTier("starter")).toBe(true);
    expect(isPlanTier("professional")).toBe(true);
    // Object prototype keys must not pass (the reason this isn't PLANS[x]).
    expect(isPlanTier("constructor")).toBe(false);
    expect(isPlanTier("__proto__")).toBe(false);
    expect(isPlanTier("enterprise")).toBe(false);
    expect(isPlanTier(undefined)).toBe(false);
  });
});

describe("isBillingInterval", () => {
  it("accepts monthly and annual only", () => {
    expect(isBillingInterval("monthly")).toBe(true);
    expect(isBillingInterval("annual")).toBe(true);
    expect(isBillingInterval("weekly")).toBe(false);
  });
});
