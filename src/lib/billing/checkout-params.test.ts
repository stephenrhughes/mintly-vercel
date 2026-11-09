import { describe, expect, it } from "vitest";

import { checkoutSessionParams, findBlockingSubscription } from "./checkout-params";
import { subscription } from "./fixtures";

const base = {
  priceId: "price_starter",
  userId: "user_1",
  email: "olivia@acme.test",
  successUrl: "https://app.test/welcome?session_id={CHECKOUT_SESSION_ID}",
  cancelUrl: "https://app.test/subscribe",
};

describe("checkoutSessionParams", () => {
  it("gives a new customer a 14-day trial with no card, cancelled if none is added (BUY-03)", () => {
    const params = checkoutSessionParams({ ...base, stripeCustomerId: null });
    expect(params).toMatchObject({
      mode: "subscription",
      line_items: [{ price: "price_starter", quantity: 1 }],
      customer_email: "olivia@acme.test",
      payment_method_collection: "if_required",
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
      client_reference_id: "user_1",
      subscription_data: {
        trial_period_days: 14,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata: { user_id: "user_1", platform: "v2" },
      },
    });
    expect(params.customer).toBeUndefined();
  });

  it("gives a returning customer no trial, on their existing Stripe customer (BUY-04)", () => {
    const params = checkoutSessionParams({ ...base, stripeCustomerId: "cus_1" });
    expect(params).toMatchObject({
      customer: "cus_1",
      payment_method_collection: "always",
      subscription_data: { metadata: { user_id: "user_1", platform: "v2" } },
    });
    expect(params.subscription_data?.trial_period_days).toBeUndefined();
    expect(params.customer_email).toBeUndefined();
  });
});

describe("findBlockingSubscription (BUY-05)", () => {
  it("blocks on a trialing, active or past-due subscription and describes it", () => {
    expect(
      findBlockingSubscription([
        subscription({ status: "canceled" }),
        subscription({ status: "trialing", trial_end: 1_800_000_000 }),
      ]),
    ).toEqual({
      status: "trialing",
      priceId: "price_monthly",
      trialEnd: 1_800_000_000,
      currentPeriodEnd: 1_800_000_000,
    });
    expect(findBlockingSubscription([subscription({ status: "past_due" })])?.status).toBe(
      "past_due",
    );
  });

  it("lets ended subscriptions through", () => {
    expect(
      findBlockingSubscription([
        subscription({ status: "canceled" }),
        subscription({ status: "incomplete_expired" }),
      ]),
    ).toBeNull();
  });
});
