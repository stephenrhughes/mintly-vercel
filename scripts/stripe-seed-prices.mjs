#!/usr/bin/env node
// Creates the self-serve Bank Account Checker prices in the new app's own
// Stripe sandbox, with the metadata the app reads (plan §6.5, §10.4, ADM-10):
// product, tier, interval, usagePlanId, trialUsagePlanId and maxTeamSize.
// Point them at TEST usage plans only (plan §10.4).
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-seed-prices.mjs \
//     --plan starter=<paidUsagePlanId>,<trialUsagePlanId> \
//     --plan standardPlus=<paid>,<trial> \
//     --plan professional=<paid>,<trial>
//
// Safe to run again: prices are found by lookup key and only their metadata
// is updated. It refuses live keys.
//
// These are flat recurring prices. Overage (BILL-05) needs metered prices on
// a Stripe Billing Meter, which arrive with the metering job in phase 7.

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Set STRIPE_SECRET_KEY to the new app's sandbox secret key.");
  process.exit(1);
}
if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) {
  console.error("Refusing to seed prices with a live key. Use the sandbox.");
  process.exit(1);
}

// From src/lib/billing/plans.ts. Starter is sold monthly only, as today.
const TIERS = {
  starter: { name: "Starter Plan", seats: 1, monthly: 3700 },
  standardPlus: { name: "Standard Plus Plan", seats: 5, monthly: 9600, annual: 96000 },
  professional: { name: "Professional Plan", seats: 15, monthly: 15700, annual: 212000 },
};

const plans = {};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] !== "--plan") continue;
  const [tier, ids = ""] = (args[++i] ?? "").split("=");
  const [paid, trial] = ids.split(",").map((s) => s?.trim());
  if (!TIERS[tier] || !paid || !trial) {
    console.error(
      `Bad --plan "${args[i]}". Use --plan <tier>=<paidUsagePlanId>,<trialUsagePlanId>.`,
    );
    process.exit(1);
  }
  plans[tier] = { paid, trial };
}
const missing = Object.keys(TIERS).filter((tier) => !plans[tier]);
if (missing.length > 0) {
  console.error(`Missing --plan for: ${missing.join(", ")}`);
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-10-28.endive" });

async function findOrCreateProduct() {
  const { data } = await stripe.products.search({ query: "metadata['app_key']:'bank_checker'" });
  if (data[0]) return data[0];
  return stripe.products.create({
    name: "Mintly Bank Account Checker",
    metadata: { app_key: "bank_checker", product: "bank_checker" },
    tax_code: "txcd_10103001", // Software as a service, business use.
  });
}

const product = await findOrCreateProduct();
console.log(`Product ${product.id}`);

for (const [tier, info] of Object.entries(TIERS)) {
  for (const interval of ["monthly", "annual"]) {
    const amount = info[interval];
    if (!amount) continue;
    const lookupKey = `bank_checker_${tier}_${interval}`;
    const metadata = {
      product: "bank_checker",
      tier,
      interval,
      usagePlanId: plans[tier].paid,
      trialUsagePlanId: plans[tier].trial,
      maxTeamSize: String(info.seats),
    };

    const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    if (data[0]) {
      await stripe.prices.update(data[0].id, { metadata });
      console.log(`Updated ${lookupKey} (${data[0].id})`);
      continue;
    }
    const price = await stripe.prices.create({
      product: product.id,
      currency: "gbp",
      unit_amount: amount,
      recurring: { interval: interval === "annual" ? "year" : "month" },
      tax_behavior: "exclusive",
      lookup_key: lookupKey,
      nickname: `${info.name} (${interval})`,
      metadata,
    });
    console.log(`Created ${lookupKey} (${price.id})`);
  }
}
