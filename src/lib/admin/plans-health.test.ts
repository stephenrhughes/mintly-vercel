import { describe, expect, it } from "vitest";

import { type HealthPrice, planCatalogueIssues } from "./plans-health";

const usagePlan = (id: string) => ({
  id,
  name: id,
  description: null,
  quota: null,
  throttle: null,
});

function price(id: string, metadata: Record<string, string>, active = true): HealthPrice {
  return {
    id,
    active,
    nickname: null,
    unitAmount: 3700,
    currency: "gbp",
    recurringInterval: "month",
    metadata,
  };
}

const good = {
  product: "bank_checker",
  tier: "starter",
  interval: "monthly",
  usagePlanId: "up_paid",
  trialUsagePlanId: "up_trial",
  maxTeamSize: "1",
};

describe("planCatalogueIssues (ADM-08, ADM-09)", () => {
  it("passes a well-formed price and counts its customers", () => {
    const health = planCatalogueIssues({
      prices: [price("price_1", good)],
      customersByPrice: new Map([["price_1", 3]]),
      missingPriceIds: [],
      usagePlans: [usagePlan("up_paid"), usagePlan("up_trial")],
    });
    expect(health.plans).toHaveLength(1);
    expect(health.plans[0]).toMatchObject({ name: "Starter Plan", customers: 3, issues: [] });
    expect(health.unusedUsagePlans).toEqual([]);
  });

  it("flags missing metadata and usage plans API Gateway doesn't have", () => {
    const health = planCatalogueIssues({
      prices: [
        price("price_2", {
          product: "bank_checker",
          tier: "starter",
          interval: "annual",
          usagePlanId: "up_gone",
        }),
      ],
      customersByPrice: new Map(),
      missingPriceIds: [],
      usagePlans: [usagePlan("up_paid")],
    });
    const issues = health.plans[0].issues.join(" ");
    expect(issues).toContain("maxTeamSize");
    expect(issues).toContain("trialUsagePlanId");
    expect(issues).toContain("up_gone isn't a usage plan");
    expect(health.unusedUsagePlans.map((p) => p.id)).toEqual(["up_paid"]);
  });

  it("flags a price with customers but no product tag, and ignores untagged prices nobody holds", () => {
    const health = planCatalogueIssues({
      prices: [price("price_held", {}), price("price_other", {})],
      customersByPrice: new Map([["price_held", 1]]),
      missingPriceIds: [],
      usagePlans: null,
    });
    expect(health.plans.map((p) => p.id)).toEqual(["price_held"]);
    expect(health.plans[0].issues[0]).toContain("No product metadata");
    expect(health.usagePlansChecked).toBe(false);
  });

  it("flags two active prices for the same tier and interval", () => {
    const health = planCatalogueIssues({
      prices: [price("price_a", good), price("price_b", good)],
      customersByPrice: new Map(),
      missingPriceIds: [],
      usagePlans: null,
    });
    for (const plan of health.plans) expect(plan.issues.join(" ")).toContain("checkout refuses");
  });

  it("lists live customers on prices Stripe didn't return", () => {
    const health = planCatalogueIssues({
      prices: [],
      customersByPrice: new Map([["price_lost", 2]]),
      missingPriceIds: ["price_lost"],
      usagePlans: [],
    });
    expect(health.missingPrices).toEqual([{ priceId: "price_lost", customers: 2 }]);
  });

  it("doesn't ask EISCD prices for a trial plan or seats", () => {
    const health = planCatalogueIssues({
      prices: [price("price_e", { product: "eiscd", usagePlanId: "up_e" })],
      customersByPrice: new Map(),
      missingPriceIds: [],
      usagePlans: [usagePlan("up_e")],
    });
    expect(health.plans[0].issues).toEqual([]);
  });
});
