import { describe, expect, it } from "vitest";

import { PAID_PLAN, PERIOD_END, price, subscription, TRIAL_PLAN } from "./fixtures";
import {
  deriveSubscriptionRecord,
  isLiveStatus,
  priceMeta,
  UPGRADE_CANCELLATION_COMMENT,
} from "./subscription-record";

// Ported from mintly-web amplify/shared/tests/subscriptionRecord.test.js.
describe("deriveSubscriptionRecord", () => {
  it("describes an active subscription the way the webhook writes it", () => {
    expect(deriveSubscriptionRecord(subscription())).toEqual({
      product: "bank_checker",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      stripeSubscriptionItemId: "si_1",
      stripePriceId: "price_monthly",
      status: "active",
      trialing: false,
      trialEnd: null,
      currentPeriodEnd: new Date(PERIOD_END * 1000),
      cancelAt: null,
      expired: false,
      replacedByUpgrade: false,
      maxTeamSize: 1,
      extraUsers: 0,
      usagePlanId: PAID_PLAN,
      missingPlanMetadata: false,
    });
  });

  it("uses the trial usage plan while trialing (PROV-01)", () => {
    const record = deriveSubscriptionRecord(
      subscription({ status: "trialing", trial_end: PERIOD_END }),
    );
    expect(record.trialing).toBe(true);
    expect(record.usagePlanId).toBe(TRIAL_PLAN);
    expect(record.trialEnd).toEqual(new Date(PERIOD_END * 1000));
  });

  it("flags a price with no usage plan metadata (PROV-10)", () => {
    const record = deriveSubscriptionRecord(subscription({ price: price({ metadata: {} }) }));
    expect(record.usagePlanId).toBeNull();
    expect(record.missingPlanMetadata).toBe(true);
  });

  it("flags a trial on a price with only a paid usage plan", () => {
    const record = deriveSubscriptionRecord(
      subscription({ status: "trialing", price: price({ metadata: { usagePlanId: PAID_PLAN } }) }),
    );
    expect(record.missingPlanMetadata).toBe(true);
  });

  it("reads the seats the price includes from its maxTeamSize metadata (PROV-09)", () => {
    const seats = (maxTeamSize?: string) =>
      deriveSubscriptionRecord(
        subscription({
          price: price({
            metadata: { usagePlanId: PAID_PLAN, ...(maxTeamSize ? { maxTeamSize } : {}) },
          }),
        }),
      ).maxTeamSize;
    expect(seats("5")).toBe(5);
    // Unknown until the price has the metadata; never a reason to fail.
    expect(seats(undefined)).toBeNull();
    expect(seats("0")).toBeNull();
    expect(seats("lots")).toBeNull();
  });

  it("reads extraUsers from subscription metadata, defaulting to 0 (PROV-09)", () => {
    expect(deriveSubscriptionRecord(subscription({ metadata: undefined })).extraUsers).toBe(0);
    expect(
      deriveSubscriptionRecord(subscription({ metadata: { extraUsers: "4" } })).extraUsers,
    ).toBe(4);
    expect(
      deriveSubscriptionRecord(subscription({ metadata: { extraUsers: "x" } })).extraUsers,
    ).toBe(0);
  });

  it("uses ended_at once ended, and cancel_at once cancellation is scheduled", () => {
    const ended = deriveSubscriptionRecord(subscription({ status: "canceled", ended_at: 5 }));
    expect(ended.expired).toBe(true);
    expect(ended.cancelAt).toEqual(new Date(5000));

    const scheduled = deriveSubscriptionRecord(
      subscription({ cancel_at_period_end: true, cancel_at: 7 }),
    );
    expect(scheduled.expired).toBe(false);
    expect(scheduled.cancelAt).toEqual(new Date(7000));
  });

  it("treats unpaid and incomplete_expired as ended (PROV-07)", () => {
    expect(deriveSubscriptionRecord(subscription({ status: "unpaid" })).expired).toBe(true);
    expect(deriveSubscriptionRecord(subscription({ status: "incomplete_expired" })).expired).toBe(
      true,
    );
    expect(deriveSubscriptionRecord(subscription({ status: "past_due" })).expired).toBe(false);
  });

  it("recognises a subscription replaced by an upgrade (PROV-07)", () => {
    const record = deriveSubscriptionRecord(
      subscription({
        status: "canceled",
        cancellation_details: { comment: UPGRADE_CANCELLATION_COMMENT },
      }),
    );
    expect(record.replacedByUpgrade).toBe(true);
  });

  it("recognises EISCD by price metadata, not a hard-coded ID", () => {
    const record = deriveSubscriptionRecord(
      subscription({ price: price({ id: "price_any", metadata: { product: "eiscd" } }) }),
    );
    expect(record.product).toBe("eiscd");
  });

  it("accepts an expanded customer", () => {
    expect(
      deriveSubscriptionRecord(subscription({ customer: { id: "cus_2" } })).stripeCustomerId,
    ).toBe("cus_2");
  });
});

describe("priceMeta", () => {
  it("reads the tier and interval checkout uses (ADM-10)", () => {
    expect(priceMeta(price())).toMatchObject({ tier: "starter", interval: "monthly" });
    expect(priceMeta(null)).toMatchObject({ product: "bank_checker", usagePlanId: null });
  });
});

describe("isLiveStatus", () => {
  it("matches the statuses that block a second checkout (BUY-05)", () => {
    expect(["trialing", "active", "past_due"].every(isLiveStatus)).toBe(true);
    expect(["canceled", "incomplete", "unpaid"].some(isLiveStatus)).toBe(false);
  });
});
