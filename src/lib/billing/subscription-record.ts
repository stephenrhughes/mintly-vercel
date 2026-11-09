// What a `subscriptions` row should hold for a Stripe subscription, ported
// from mintly-web amplify/shared/subscriptionRecord.cjs. The webhook and,
// later, the admin resync (ADM-05) both use this, so they can never disagree
// about what a row should say. Stripe is the source of truth.
//
// Differences from the old copy:
// - The current Stripe API keeps current_period_end on the subscription
//   item, not the subscription.
// - EISCD is recognised by price metadata (product=eiscd), not a hard-coded
//   price ID (plan §6.5).
// - The old list of acceptable expiry dates (current_period_end plus the
//   invoice's days until due) is gone. A row is active while it hasn't
//   expired and its key is enabled (SUB-02), and the period end is refreshed
//   from Stripe on every event, which covers PROV-08.

import { parseSeats } from "./seats";

/** Statuses that mean the customer currently holds the subscription (BUY-05). */
export const LIVE_STATUSES = ["trialing", "active", "past_due"] as const;

/** Statuses after which the API key is off (PROV-07). */
export const ENDED_STATUSES = ["canceled", "unpaid", "incomplete_expired"] as const;

/**
 * The cancellation comment for a subscription replaced by an upgrade or an
 * accepted offer. Ending one of these must not disable the key, because the
 * replacement owns it now (PROV-07).
 */
export const UPGRADE_CANCELLATION_COMMENT = "Automatically cancelled by upgrading";

export type Product = "bank_checker" | "eiscd";

type Metadata = Record<string, string> | null | undefined;

/** The parts of a Stripe price this reads. Stripe.Price satisfies it. */
export type PriceLike = { id: string; metadata?: Metadata };

/** The parts of a Stripe subscription this reads. Stripe.Subscription satisfies it. */
export type SubscriptionLike = {
  id: string;
  status: string;
  customer: string | { id: string };
  metadata?: Metadata;
  trial_end?: number | null;
  cancel_at?: number | null;
  cancel_at_period_end?: boolean;
  ended_at?: number | null;
  cancellation_details?: { comment?: string | null } | null;
  items: {
    data: Array<{
      id: string;
      object?: string;
      current_period_end?: number | null;
      price: PriceLike;
    }>;
  };
};

export type PriceMeta = {
  product: Product;
  usagePlanId: string | null;
  trialUsagePlanId: string | null;
  maxTeamSize: number | null;
  tier: string | null;
  interval: string | null;
};

/** The metadata the app relies on, read from a Stripe price (ADM-10). */
export function priceMeta(price: PriceLike | null | undefined): PriceMeta {
  const metadata = price?.metadata ?? {};
  const text = (key: string) => metadata[key]?.trim() || null;
  return {
    product: text("product") === "eiscd" ? "eiscd" : "bank_checker",
    usagePlanId: text("usagePlanId"),
    trialUsagePlanId: text("trialUsagePlanId"),
    maxTeamSize: parseSeats(metadata.maxTeamSize) ?? null,
    tier: text("tier"),
    interval: text("interval"),
  };
}

export function subscriptionItem(sub: SubscriptionLike) {
  return sub.items.data.find((item) => item.object === "subscription_item") ?? sub.items.data[0];
}

export function customerId(sub: SubscriptionLike): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

export function isLiveStatus(status: string): boolean {
  return (LIVE_STATUSES as readonly string[]).includes(status);
}

export function isEndedStatus(status: string): boolean {
  return (ENDED_STATUSES as readonly string[]).includes(status);
}

const toDate = (seconds: number | null | undefined) =>
  typeof seconds === "number" ? new Date(seconds * 1000) : null;

export type SubscriptionRecord = {
  product: Product;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeSubscriptionItemId: string | null;
  stripePriceId: string;
  status: string;
  trialing: boolean;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  /** When the subscription ends: ended_at once ended, cancel_at once scheduled. */
  cancelAt: Date | null;
  expired: boolean;
  /** Ended because an upgrade or accepted offer replaced it (PROV-07). */
  replacedByUpgrade: boolean;
  maxTeamSize: number | null;
  extraUsers: number;
  /** The usage plan the key belongs in now: the trial plan while trialing (PROV-01). */
  usagePlanId: string | null;
  /** The price lacks the usage plan metadata the webhook relies on (PROV-10). */
  missingPlanMetadata: boolean;
};

/** The row the webhook writes for this subscription. */
export function deriveSubscriptionRecord(sub: SubscriptionLike): SubscriptionRecord {
  const item = subscriptionItem(sub);
  const meta = priceMeta(item?.price);
  const trialing = sub.status === "trialing";
  const expired = isEndedStatus(sub.status);
  const usagePlanId = (trialing ? meta.trialUsagePlanId : meta.usagePlanId) ?? null;

  let cancelAt: Date | null = null;
  if (expired) cancelAt = toDate(sub.ended_at);
  else if (sub.cancel_at_period_end || sub.cancel_at) cancelAt = toDate(sub.cancel_at);

  return {
    product: meta.product,
    stripeCustomerId: customerId(sub),
    stripeSubscriptionId: sub.id,
    stripeSubscriptionItemId: item?.id ?? null,
    stripePriceId: item?.price.id ?? "",
    status: sub.status,
    trialing,
    trialEnd: toDate(sub.trial_end),
    currentPeriodEnd: toDate(item?.current_period_end),
    cancelAt,
    expired,
    replacedByUpgrade: sub.cancellation_details?.comment?.trim() === UPGRADE_CANCELLATION_COMMENT,
    maxTeamSize: meta.maxTeamSize,
    extraUsers: Number.parseInt(sub.metadata?.extraUsers ?? "0", 10) || 0,
    usagePlanId,
    missingPlanMetadata: !usagePlanId,
  };
}
