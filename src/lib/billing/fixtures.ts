// Stripe-shaped test data, shared by the billing unit tests.

import type { PriceLike, SubscriptionLike } from "./subscription-record";

export const PERIOD_END = 1_800_000_000;

export const PAID_PLAN = "plan_paid";
export const TRIAL_PLAN = "plan_trial";

export function price(overrides: Partial<PriceLike> & { metadata?: Record<string, string> } = {}) {
  return {
    id: "price_monthly",
    metadata: {
      product: "bank_checker",
      tier: "starter",
      interval: "monthly",
      usagePlanId: PAID_PLAN,
      trialUsagePlanId: TRIAL_PLAN,
      maxTeamSize: "1",
    },
    ...overrides,
  } satisfies PriceLike;
}

export function subscription(
  overrides: Partial<SubscriptionLike> & { price?: PriceLike } = {},
): SubscriptionLike {
  const { price: itemPrice = price(), ...rest } = overrides;
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    metadata: {},
    trial_end: null,
    cancel_at: null,
    cancel_at_period_end: false,
    ended_at: null,
    cancellation_details: null,
    items: {
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          current_period_end: PERIOD_END,
          price: itemPrice,
        },
      ],
    },
    ...rest,
  };
}
