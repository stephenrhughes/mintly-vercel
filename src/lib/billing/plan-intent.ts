// BUY-02: the plan a visitor picked on the pricing page survives sign-up.
// It travels as a plan tier slug (never a Stripe price ID, so a tampered link
// can't name an arbitrary price) in `?plan=`, which `next` carries through
// sign-in and sign-up. A 24-hour cookie mirrors it for the trips that lose
// the query string, such as confirming the email in another tab.

import { type BillingInterval, isBillingInterval, isPlanTier, type PlanTier } from "./plans";

export const PLAN_INTENT_COOKIE = "mintly_plan_intent";
export const PLAN_INTENT_MAX_AGE = 60 * 60 * 24;

export type PlanIntent = { tier: PlanTier; interval: BillingInterval };

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The intent in `?plan=` (and optional `&interval=`), if valid. */
export function intentFromParams(params: Params): PlanIntent | null {
  const tier = first(params.plan);
  if (!isPlanTier(tier)) return null;
  const interval = first(params.interval);
  return { tier, interval: isBillingInterval(interval) ? interval : "monthly" };
}

/** The intent carried by a `next` path such as `/subscribe?plan=starter`. */
export function intentFromNext(next: string | null | undefined): PlanIntent | null {
  if (!next) return null;
  let url: URL;
  try {
    url = new URL(next, "http://app.invalid");
  } catch {
    return null;
  }
  if (url.pathname !== "/subscribe") return null;
  return intentFromParams(Object.fromEntries(url.searchParams));
}

export function encodeIntent(intent: PlanIntent): string {
  return `${intent.tier}:${intent.interval}`;
}

export function decodeIntent(value: string | null | undefined): PlanIntent | null {
  if (!value) return null;
  const [tier, interval] = value.split(":");
  return intentFromParams({ plan: tier, interval });
}

/** The query string wins: it is the click that just happened (mintly-web pendingPlan.js). */
export function resolveIntent(params: Params, cookieValue: string | undefined): PlanIntent | null {
  return intentFromParams(params) ?? decodeIntent(cookieValue);
}

export function planIntentCookieOptions(env: Record<string, string | undefined> = process.env) {
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: PLAN_INTENT_MAX_AGE,
  };
}
