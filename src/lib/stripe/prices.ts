// Resolving self-serve prices from Stripe price metadata (plan §6.5, ADM-10):
// `product`, `tier` and `interval` pick the price, so no price IDs are
// hard-coded. Pure, so it can be tested without Stripe; catalogue.ts loads
// the prices.

import type { BillingInterval, PlanTier } from "@/lib/billing/plans";
import { type PriceLike, priceMeta } from "@/lib/billing/subscription-record";

export type CataloguePrice = PriceLike & {
  active?: boolean;
  unit_amount?: number | null;
  currency?: string;
  recurring?: { interval: string } | null;
};

/** The active self-serve price for a tier and interval, or null. */
export function findPlanPrice<P extends CataloguePrice>(
  prices: readonly P[],
  tier: PlanTier,
  interval: BillingInterval,
): P | null {
  const matches = prices.filter((price) => {
    if (price.active === false) return false;
    const meta = priceMeta(price);
    return meta.product === "bank_checker" && meta.tier === tier && meta.interval === interval;
  });
  // Two matches means the catalogue is ambiguous; refuse rather than guess.
  return matches.length === 1 ? matches[0] : null;
}

/** Which intervals each tier can be bought on, from what Stripe has. */
export function availableIntervals(
  prices: readonly CataloguePrice[],
  tiers: readonly PlanTier[],
): Record<PlanTier, BillingInterval[]> {
  const result = {} as Record<PlanTier, BillingInterval[]>;
  for (const tier of tiers) {
    result[tier] = (["monthly", "annual"] as const).filter((interval) =>
      Boolean(findPlanPrice(prices, tier, interval)),
    );
  }
  return result;
}
