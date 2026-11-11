// What a monthly volume costs on each plan, and which plan is cheapest
// (WEB-05), ported from mintly-web src/utils/priceCalculator.js. Pure: same
// inputs, same answer. All figures exclude VAT, as on the pricing page.
//
// One change from the old site: customers can't buy extra seats any more
// (plan §6.12, only admins set them), so a plan whose seats are too few is
// unavailable rather than priced with paid seats.

import {
  EISCD_PLAN,
  ENTERPRISE_TIERS,
  type EnterpriseTier,
  PLAN_TIERS,
  PLANS,
  SELF_SERVE_CEILING,
} from "@/lib/billing/plans";

export const MIN_REQUESTS = 100;
export const MAX_SLIDER_REQUESTS = 500_000;
export const MAX_REQUESTS = 10_000_000;
export const MAX_SEATS = 500;
export const SLIDER_STEPS = 100;
const MONTHS_PER_YEAR = 12;

export type CalculatorTier = {
  key: string;
  name: string;
  monthlyPriceGbp: number | null;
  includedRequestsCount: number;
  overagePence: number | null;
  minRequests?: number;
  maxRequests: number;
  maxUsers: number;
  selfServe: boolean;
  quoteOnly?: boolean;
};

export const CALCULATOR_TIERS: CalculatorTier[] = [
  ...PLAN_TIERS.map((tier) => {
    const plan = PLANS[tier];
    return {
      key: tier,
      name: plan.name,
      monthlyPriceGbp: plan.monthlyPriceGbp,
      includedRequestsCount: plan.includedRequestsCount,
      overagePence: plan.overagePence,
      maxRequests: SELF_SERVE_CEILING,
      maxUsers: plan.maxUsers,
      selfServe: true,
    };
  }),
  ...ENTERPRISE_TIERS.map((tier: EnterpriseTier) => ({
    key: tier.key,
    name: tier.name,
    monthlyPriceGbp: tier.monthlyPriceGbp,
    includedRequestsCount: tier.includedRequestsCount,
    overagePence: tier.overagePence,
    minRequests: tier.minRequests,
    maxRequests: tier.maxRequests,
    maxUsers: Number.POSITIVE_INFINITY,
    selfServe: false,
    quoteOnly: tier.quoteOnly,
  })),
];

/** "£37" stays "£37"; an overage line reads "£172.42". */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  const whole = Number.isInteger(rounded);
  return `£${rounded.toLocaleString("en-GB", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Pence to two places, without floating-point noise (0.8999… → 0.9p). */
export function formatPence(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100) / 100}p`;
}

export const formatRequests = (value: number) => value.toLocaleString("en-GB");

export function sanitiseRequests(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, MAX_REQUESTS);
}

export function sanitiseSeats(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_SEATS);
}

// The slider is logarithmic so the low end, where most visitors sit, is
// easy to land on.
const LN_MIN = Math.log(MIN_REQUESTS);
const LN_MAX = Math.log(MAX_SLIDER_REQUESTS);

/** Snap to a figure a person would type, within ~5% of the exact value. */
function snapRequests(value: number): number {
  let step = 2500;
  if (value < 500) step = 5;
  else if (value < 1000) step = 10;
  else if (value < 10_000) step = 50;
  else if (value < 100_000) step = 500;
  return Math.round(value / step) * step;
}

export function sliderToRequests(position: number): number {
  const clamped = Math.min(Math.max(Number(position) || 0, 0), SLIDER_STEPS);
  return snapRequests(Math.exp(LN_MIN + (clamped / SLIDER_STEPS) * (LN_MAX - LN_MIN)));
}

export function requestsToSlider(requests: number): number {
  const clamped = Math.min(
    Math.max(Number(requests) || MIN_REQUESTS, MIN_REQUESTS),
    MAX_SLIDER_REQUESTS,
  );
  return Math.round((SLIDER_STEPS * (Math.log(clamped) - LN_MIN)) / (LN_MAX - LN_MIN));
}

export type TierCost = {
  key: string;
  name: string;
  tier: CalculatorTier;
  quoteOnly: boolean;
  selfServe: boolean;
  available: boolean;
  monthlyGbp: number | null;
  overageRequests: number;
  overageGbp: number;
  /** Why the tier can't carry this volume or team, when it can't. */
  reason: string | null;
};

export function costForTier(
  tier: CalculatorTier,
  { requests = 0, seats = 1 }: { requests?: number; seats?: number } = {},
): TierCost {
  const base = {
    key: tier.key,
    name: tier.name,
    tier,
    quoteOnly: Boolean(tier.quoteOnly),
    selfServe: tier.selfServe,
    overageRequests: 0,
    overageGbp: 0,
  };
  const unavailable = (reason: string): TierCost => ({
    ...base,
    available: false,
    monthlyGbp: null,
    reason,
  });

  if (tier.quoteOnly) return { ...base, available: true, monthlyGbp: null, reason: null };
  if (tier.monthlyPriceGbp === null) return unavailable("Price on application");
  if (tier.minRequests && requests < tier.minRequests) {
    return unavailable(`From ${formatRequests(tier.minRequests)} checks a month`);
  }
  if (requests > tier.maxRequests) {
    return unavailable(
      tier.selfServe
        ? `Self-serve goes up to ${formatRequests(tier.maxRequests)} checks a month`
        : `Covers up to ${formatRequests(tier.maxRequests)} checks a month`,
    );
  }
  if (seats > tier.maxUsers) {
    return unavailable(`Covers up to ${tier.maxUsers} ${tier.maxUsers === 1 ? "user" : "users"}`);
  }

  const overageRequests = Math.max(0, requests - tier.includedRequestsCount);
  const overageGbp = (overageRequests * (tier.overagePence ?? 0)) / 100;
  return {
    ...base,
    available: true,
    overageRequests,
    overageGbp,
    monthlyGbp: tier.monthlyPriceGbp + overageGbp,
    reason: null,
  };
}

export type Quote = {
  requests: number;
  seats: number;
  tiers: TierCost[];
  recommended: TierCost | null;
  isQuoteOnly: boolean;
  eiscd: { name: string; annualGbp: number; monthlyGbp: number } | null;
  totals: { monthlyGbp: number | null; annualGbp: number | null };
  /** The blended rate for the checks themselves (EISCD excluded). */
  pencePerCheck: number | null;
};

/** Every tier costed, the cheapest picked (ties go to the bigger allowance), plus EISCD if wanted. */
export function buildQuote({
  requests = 0,
  seats = 1,
  includeEiscd = false,
}: { requests?: unknown; seats?: unknown; includeEiscd?: boolean } = {}): Quote {
  const volume = sanitiseRequests(requests);
  const teamSize = sanitiseSeats(seats);
  const tiers = CALCULATOR_TIERS.map((tier) =>
    costForTier(tier, { requests: volume, seats: teamSize }),
  );

  const priced = tiers
    .filter((row) => row.available && row.monthlyGbp !== null)
    .sort((a, b) =>
      a.monthlyGbp !== b.monthlyGbp
        ? a.monthlyGbp! - b.monthlyGbp!
        : b.tier.includedRequestsCount - a.tier.includedRequestsCount,
    );
  const recommended = priced[0] ?? tiers.find((row) => row.quoteOnly && row.available) ?? null;

  const eiscdAnnualGbp = includeEiscd ? EISCD_PLAN.annualPriceGbp : 0;
  const eiscdMonthlyGbp = eiscdAnnualGbp / MONTHS_PER_YEAR;
  const planMonthlyGbp = recommended?.monthlyGbp ?? null;

  return {
    requests: volume,
    seats: teamSize,
    tiers,
    recommended,
    isQuoteOnly: Boolean(recommended?.quoteOnly),
    eiscd: includeEiscd
      ? { name: EISCD_PLAN.name, annualGbp: eiscdAnnualGbp, monthlyGbp: eiscdMonthlyGbp }
      : null,
    totals: {
      monthlyGbp: planMonthlyGbp === null ? null : planMonthlyGbp + eiscdMonthlyGbp,
      annualGbp: planMonthlyGbp === null ? null : planMonthlyGbp * MONTHS_PER_YEAR + eiscdAnnualGbp,
    },
    pencePerCheck: planMonthlyGbp === null || volume === 0 ? null : (planMonthlyGbp * 100) / volume,
  };
}
