// Display facts for the self-serve Bank Account Checker plans (BUY-01),
// ported from mintly-web src/utils/plans.js. Stripe price IDs never live
// here: checkout resolves the price from Stripe metadata (tier, interval;
// plan §6.5, ADM-10), so this file only says what each plan offers.
//
// Each plan carries the same facts twice: strings for the cards to render,
// and numbers to compute with. plans.test.ts fails if they disagree.

/**
 * Above this many checks a month the pricing page stops selling and asks for
 * a call (plan §6.12: "Talk to us").
 */
export const SELF_SERVE_CEILING = 50_000;

export const PLAN_TIERS = ["starter", "standardPlus", "professional"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const BILLING_INTERVALS = ["monthly", "annual"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export type Plan = {
  tier: PlanTier;
  name: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  includedRequests: string;
  includedUsers: string;
  pricePerRequest: string;
  throttle: string;
  monthlyPriceGbp: number;
  annualPriceGbp: number;
  includedRequestsCount: number;
  overagePence: number;
  /** Seats the plan includes, owner included (TEAM-03). */
  maxUsers: number;
};

export const PLANS: Record<PlanTier, Plan> = {
  starter: {
    tier: "starter",
    name: "Starter Plan",
    description: "Basic plan that has limited quantity of checks. Suits very low volume users.",
    monthlyPrice: "£37",
    annualPrice: "£360",
    includedRequests: "250",
    includedUsers: "Single user",
    pricePerRequest: "5p",
    throttle: "10",
    monthlyPriceGbp: 37,
    annualPriceGbp: 360,
    includedRequestsCount: 250,
    overagePence: 5,
    maxUsers: 1,
  },
  standardPlus: {
    tier: "standardPlus",
    name: "Standard Plus Plan",
    description: "Mid-volume and mid-throughput plan, ideal for smaller customers and startups.",
    monthlyPrice: "£96",
    annualPrice: "£960",
    includedRequests: "10,000",
    includedUsers: "5 users",
    pricePerRequest: "1.2p",
    throttle: "100",
    monthlyPriceGbp: 96,
    annualPriceGbp: 960,
    includedRequestsCount: 10_000,
    overagePence: 1.2,
    maxUsers: 5,
  },
  professional: {
    tier: "professional",
    name: "Professional Plan",
    description:
      "For customers who need a high allocation of requests each month through our API or the web tools.",
    monthlyPrice: "£157",
    annualPrice: "£2,120",
    includedRequests: "25,000",
    includedUsers: "15 users",
    pricePerRequest: "0.8p",
    throttle: "1000",
    monthlyPriceGbp: 157,
    annualPriceGbp: 2120,
    includedRequestsCount: 25_000,
    overagePence: 0.8,
    maxUsers: 15,
  },
};

/** The trial every new customer starts with (BUY-03). */
export const TRIAL_DAYS = 14;

/**
 * Whether a value names a plan tier. `PLANS[value]` alone isn't safe:
 * `PLANS.constructor` is truthy, so `?plan=constructor` would pass.
 */
export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && (PLAN_TIERS as readonly string[]).includes(value);
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return typeof value === "string" && (BILLING_INTERVALS as readonly string[]).includes(value);
}

export function getPlan(tier: PlanTier): Plan {
  return PLANS[tier];
}
