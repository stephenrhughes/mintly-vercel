// The Stripe Checkout session for a plan (BUY-03, BUY-04), as a pure
// function of who is buying. Ported from mintly-web register/src/stripeHelpers.js.

import type Stripe from "stripe";

import { TRIAL_DAYS } from "./plans";
import { isLiveStatus } from "./subscription-record";

export type CheckoutInput = {
  priceId: string;
  userId: string;
  email: string;
  /** The buyer's Stripe customer, if they have bought before (BUY-04). */
  stripeCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
  /** Where the checkout came from, for trial review (APPR-04): a hashed IP and a country. */
  signals?: Record<string, string>;
};

export function checkoutSessionParams(input: CheckoutInput): Stripe.Checkout.SessionCreateParams {
  const returning = Boolean(input.stripeCustomerId);
  // The buyer's user ID goes on the subscription as well as the session, so
  // customer.subscription.created can provision even if it arrives before
  // checkout.session.completed.
  const metadata = { ...input.signals, user_id: input.userId, platform: "v2" };

  return {
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    client_reference_id: input.userId,
    metadata,
    automatic_tax: { enabled: true },
    allow_promotion_codes: true,
    consent_collection: { terms_of_service: "required" },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    ...(returning
      ? {
          // BUY-04: a returning customer gets no trial and pays now. Automatic
          // tax needs their address, so let Checkout update it.
          customer: input.stripeCustomerId as string,
          customer_update: { address: "auto", name: "auto" },
          payment_method_collection: "always",
          subscription_data: { metadata },
        }
      : {
          // BUY-03: a 14-day trial with no card. If no payment method has been
          // added by the end, the trial is cancelled rather than billed.
          customer_email: input.email,
          name_collection: { business: { enabled: true }, individual: { enabled: false } },
          payment_method_collection: "if_required",
          subscription_data: {
            metadata,
            trial_period_days: TRIAL_DAYS,
            trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
          },
        }),
  };
}

/** What the "you already have a plan" screen shows (BUY-05). */
export type BlockingSubscription = {
  status: string;
  priceId: string | null;
  trialEnd: number | null;
  currentPeriodEnd: number | null;
};

type SubLike = {
  status: string;
  trial_end?: number | null;
  items: { data: Array<{ price: { id: string }; current_period_end?: number | null }> };
};

/** The customer's live subscription, which blocks a second checkout (BUY-05). */
export function findBlockingSubscription(subs: readonly SubLike[]): BlockingSubscription | null {
  const sub = subs.find((s) => isLiveStatus(s.status));
  if (!sub) return null;
  const item = sub.items.data[0];
  return {
    status: sub.status,
    priceId: item?.price.id ?? null,
    trialEnd: sub.trial_end ?? null,
    currentPeriodEnd: item?.current_period_end ?? null,
  };
}
