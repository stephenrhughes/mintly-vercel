import { describe, expect, it } from "vitest";

import { customPriceMetadata } from "./custom-price";

describe("customPriceMetadata (ADM-12, PLAN-10)", () => {
  it("keeps the product, usage plans and seats, drops the tier and marks it custom", () => {
    expect(
      customPriceMetadata(
        {
          product: "bank_checker",
          tier: "professional",
          interval: "monthly",
          usagePlanId: "up_paid",
          trialUsagePlanId: "up_trial",
          maxTeamSize: "15",
        },
        "year",
      ),
    ).toEqual({
      product: "bank_checker",
      usagePlanId: "up_paid",
      trialUsagePlanId: "up_trial",
      maxTeamSize: "15",
      custom: "true",
      interval: "annual",
    });
  });
});
