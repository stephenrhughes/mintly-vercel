// The plan catalogue health check (ADM-08, ADM-09), ported from mintly-web
// adminCustomers/src/planCatalogue.js. Stripe price metadata is the source
// of truth for plans (ADM-10). This app tags prices with `product`, `tier`
// and `interval` rather than the old `mintlyPlan` flag (docs/stripe-setup.md
// §2), so a "plan" is any price with `product` metadata or a live customer.

import { planLabel } from "@/lib/billing/plan-name";
import { priceMeta } from "@/lib/billing/subscription-record";
import type { UsagePlanInfo } from "@/lib/aws/types";

export type HealthPrice = {
  id: string;
  active: boolean;
  nickname: string | null;
  unitAmount: number | null;
  currency: string | null;
  recurringInterval: string | null;
  metadata: Record<string, string>;
};

export type PlanRow = {
  id: string;
  name: string;
  active: boolean;
  product: string | null;
  tier: string | null;
  interval: string | null;
  custom: boolean;
  unitAmount: number | null;
  currency: string | null;
  maxTeamSize: number | null;
  usagePlanId: string | null;
  trialUsagePlanId: string | null;
  customers: number;
  issues: string[];
};

export type CatalogueHealth = {
  plans: PlanRow[];
  /** Live customers on prices Stripe didn't return. */
  missingPrices: Array<{ priceId: string; customers: number }>;
  /** Usage plans that no price points at. */
  unusedUsagePlans: UsagePlanInfo[];
  /** False when the usage plans couldn't be listed, so those checks were skipped. */
  usagePlansChecked: boolean;
};

export function planCatalogueIssues(input: {
  prices: HealthPrice[];
  /** Live subscriptions per price ID, from the database. */
  customersByPrice: Map<string, number>;
  /** Price IDs with live customers that Stripe couldn't find. */
  missingPriceIds: string[];
  usagePlans: UsagePlanInfo[] | null;
}): CatalogueHealth {
  const knownPlans = input.usagePlans ? new Set(input.usagePlans.map((p) => p.id)) : null;
  const used = new Set<string>();

  const relevant = input.prices.filter(
    (price) => price.metadata.product || (input.customersByPrice.get(price.id) ?? 0) > 0,
  );

  // Two active prices for one tier and interval make checkout refuse both.
  const slots = new Map<string, number>();
  for (const price of relevant) {
    const meta = priceMeta(price);
    if (!price.active || meta.product !== "bank_checker" || !meta.tier || !meta.interval) continue;
    const slot = `${meta.tier}/${meta.interval}`;
    slots.set(slot, (slots.get(slot) ?? 0) + 1);
  }

  const plans = relevant.map((price): PlanRow => {
    const meta = priceMeta(price);
    const issues: string[] = [];
    const product = price.metadata.product?.trim() || null;
    if (!product) issues.push("No product metadata, so it isn't recognised as a Mintly plan.");

    if (meta.usagePlanId) used.add(meta.usagePlanId);
    if (meta.trialUsagePlanId) used.add(meta.trialUsagePlanId);

    if (meta.product === "bank_checker") {
      if (!meta.maxTeamSize) issues.push("No maxTeamSize, so the seat limit is unknown.");
      if (!meta.trialUsagePlanId) {
        issues.push("No trialUsagePlanId: trials on this price fail to provision.");
      }
      if (!meta.tier && !meta.custom && price.active) {
        issues.push("No tier and not custom: treated as a legacy price.");
      }
      if (meta.tier && meta.interval && (slots.get(`${meta.tier}/${meta.interval}`) ?? 0) > 1) {
        issues.push(
          `Another active price is also ${meta.tier} ${meta.interval}; checkout refuses both.`,
        );
      }
    }
    if (!meta.usagePlanId) issues.push("No usagePlanId: paid subscriptions fail to provision.");

    if (knownPlans) {
      for (const [label, id] of [
        ["usagePlanId", meta.usagePlanId],
        ["trialUsagePlanId", meta.trialUsagePlanId],
      ] as const) {
        if (id && !knownPlans.has(id)) {
          issues.push(`${label} ${id} isn't a usage plan in API Gateway.`);
        }
      }
    }

    return {
      id: price.id,
      name: planLabel({ id: price.id, nickname: price.nickname, metadata: price.metadata }),
      active: price.active,
      product,
      tier: meta.tier,
      interval: meta.interval ?? price.recurringInterval,
      custom: meta.custom,
      unitAmount: price.unitAmount,
      currency: price.currency,
      maxTeamSize: meta.maxTeamSize,
      usagePlanId: meta.usagePlanId,
      trialUsagePlanId: meta.trialUsagePlanId,
      customers: input.customersByPrice.get(price.id) ?? 0,
      issues,
    };
  });

  plans.sort(
    (a, b) =>
      Number(b.issues.length > 0) - Number(a.issues.length > 0) ||
      (a.product ?? "").localeCompare(b.product ?? "") ||
      a.name.localeCompare(b.name),
  );

  return {
    plans,
    missingPrices: input.missingPriceIds.map((priceId) => ({
      priceId,
      customers: input.customersByPrice.get(priceId) ?? 0,
    })),
    unusedUsagePlans: (input.usagePlans ?? []).filter((plan) => !used.has(plan.id)),
    usagePlansChecked: input.usagePlans !== null,
  };
}
