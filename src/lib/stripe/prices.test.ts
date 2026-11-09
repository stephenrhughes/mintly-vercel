import { describe, expect, it } from "vitest";

import { price } from "@/lib/billing/fixtures";

import { availableIntervals, findPlanPrice } from "./prices";

const catalogue = [
  price({ id: "price_starter_m" }),
  price({
    id: "price_pro_m",
    metadata: { product: "bank_checker", tier: "professional", interval: "monthly" },
  }),
  price({
    id: "price_pro_a",
    metadata: { product: "bank_checker", tier: "professional", interval: "annual" },
  }),
  { ...price({ id: "price_pro_old" }), active: false },
  price({
    id: "price_eiscd",
    metadata: { product: "eiscd", tier: "starter", interval: "monthly" },
  }),
];

describe("findPlanPrice (ADM-10)", () => {
  it("finds the price by tier and interval metadata", () => {
    expect(findPlanPrice(catalogue, "starter", "monthly")?.id).toBe("price_starter_m");
    expect(findPlanPrice(catalogue, "professional", "annual")?.id).toBe("price_pro_a");
  });

  it("ignores inactive and EISCD prices, and missing combinations", () => {
    expect(findPlanPrice(catalogue, "starter", "annual")).toBeNull();
    expect(findPlanPrice(catalogue, "standardPlus", "monthly")).toBeNull();
  });

  it("refuses an ambiguous catalogue", () => {
    expect(
      findPlanPrice([...catalogue, price({ id: "price_dupe" })], "starter", "monthly"),
    ).toBeNull();
  });
});

describe("availableIntervals", () => {
  it("lists what Stripe sells for each tier", () => {
    expect(availableIntervals(catalogue, ["starter", "professional", "standardPlus"])).toEqual({
      starter: ["monthly"],
      professional: ["monthly", "annual"],
      standardPlus: [],
    });
  });
});
