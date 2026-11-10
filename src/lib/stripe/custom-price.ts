import "server-only";

import type Stripe from "stripe";

import { clearPriceCache } from "./catalogue";
import { requireStripe } from "./client";

// A price made for one customer (ADM-11, ADM-12, PLAN-10): a copy of a base
// price's product and metadata (product, usage plans, seats) at a custom
// amount and interval, tagged custom=true and without a tier, so checkout
// never offers it and its owner is asked to contact Mintly to change plan.

export function customPriceMetadata(
  base: Record<string, string>,
  interval: "month" | "year",
): Record<string, string> {
  const rest = Object.fromEntries(
    Object.entries(base).filter(([key]) => key !== "tier" && key !== "interval"),
  );
  return { ...rest, custom: "true", interval: interval === "year" ? "annual" : "monthly" };
}

export async function createCustomPrice(input: {
  basePriceId: string;
  unitAmount: number;
  interval: "month" | "year";
  nickname: string;
  idempotencyKey: string;
}): Promise<string> {
  const stripe = requireStripe();
  const base = await stripe.prices.retrieve(input.basePriceId);
  const product =
    typeof base.product === "string" ? base.product : (base.product as Stripe.Product).id;
  const price = await stripe.prices.create(
    {
      product,
      currency: base.currency,
      unit_amount: input.unitAmount,
      recurring: { interval: input.interval },
      nickname: input.nickname,
      metadata: customPriceMetadata({ ...base.metadata }, input.interval),
    },
    { idempotencyKey: input.idempotencyKey },
  );
  clearPriceCache();
  return price.id;
}
