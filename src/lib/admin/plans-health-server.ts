import "server-only";

import type Stripe from "stripe";

import { listUsagePlans } from "@/lib/aws/usagePlans";
import { listActivePrices } from "@/lib/stripe/catalogue";
import { requireStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/admin";

import { type CatalogueHealth, type HealthPrice, planCatalogueIssues } from "./plans-health";

// Loads what the plans health page checks (ADM-08, ADM-09): Stripe's
// active recurring prices, the prices live customers hold, and API Gateway's
// usage plans. Callers have already passed requireAdmin().

function toHealthPrice(price: Stripe.Price): HealthPrice {
  return {
    id: price.id,
    active: price.active,
    nickname: price.nickname,
    unitAmount: price.unit_amount,
    currency: price.currency,
    recurringInterval: price.recurring?.interval ?? null,
    metadata: { ...price.metadata },
  };
}

export async function loadCatalogueHealth(): Promise<CatalogueHealth> {
  const db = createServiceClient();
  const [prices, live, usagePlans] = await Promise.all([
    listActivePrices(),
    db
      .from("subscriptions")
      .select("stripe_price_id")
      .eq("expired", false)
      .returns<Array<{ stripe_price_id: string }>>(),
    listUsagePlans().catch((error) => {
      console.error("listing usage plans failed", error);
      return null;
    }),
  ]);
  if (live.error) throw new Error(`reading subscriptions failed: ${live.error.message}`);

  const customersByPrice = new Map<string, number>();
  for (const row of live.data) {
    customersByPrice.set(row.stripe_price_id, (customersByPrice.get(row.stripe_price_id) ?? 0) + 1);
  }

  // Live customers on inactive (legacy) prices: fetch those too.
  const listed = new Set(prices.map((p) => p.id));
  const all = prices.map(toHealthPrice);
  const missingPriceIds: string[] = [];
  const stripe = requireStripe();
  await Promise.all(
    [...customersByPrice.keys()]
      .filter((id) => !listed.has(id))
      .map(async (id) => {
        try {
          all.push(toHealthPrice(await stripe.prices.retrieve(id)));
        } catch {
          missingPriceIds.push(id);
        }
      }),
  );

  return planCatalogueIssues({ prices: all, customersByPrice, missingPriceIds, usagePlans });
}
