import "server-only";

import type Stripe from "stripe";

import type { BillingInterval, PlanTier } from "@/lib/billing/plans";

import { requireStripe } from "./client";
import { findPlanPrice } from "./prices";

// The Stripe price catalogue, cached in memory on the server for a few
// minutes (plan §4: prices are not copied into the database; Stripe price
// metadata is the source of truth).

const TTL_MS = 5 * 60 * 1000;

let cache: { at: number; prices: Stripe.Price[] } | null = null;

export async function listActivePrices(): Promise<Stripe.Price[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.prices;
  const stripe = requireStripe();
  const prices: Stripe.Price[] = [];
  for await (const price of stripe.prices.list({ active: true, type: "recurring", limit: 100 })) {
    prices.push(price);
  }
  cache = { at: Date.now(), prices };
  return prices;
}

export async function getPlanPrice(
  tier: PlanTier,
  interval: BillingInterval,
): Promise<Stripe.Price | null> {
  return findPlanPrice(await listActivePrices(), tier, interval);
}

/** A price by ID, from the cache when it's there. Inactive (legacy) prices are fetched. */
export async function getPrice(id: string): Promise<Stripe.Price> {
  const cached = cache?.prices.find((price) => price.id === id);
  return cached ?? requireStripe().prices.retrieve(id);
}

/** Forget the cached catalogue, after a price is created (ADM-12). */
export function clearPriceCache() {
  cache = null;
}
