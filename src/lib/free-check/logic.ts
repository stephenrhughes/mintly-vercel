// The free checker's browser-side accounting (FREE-03, FREE-04), ported from
// mintly-web src/components/tryItLogic.js. The server's per-IP limit is the
// real enforcement; this cookie mirrors it so the page can say how many
// checks are left without asking.

import {
  FREE_CHECK_OFFER_FROM,
  FREE_CHECK_RATING_AT,
  FREE_CHECK_WEEKLY_LIMIT,
} from "@/lib/free-check/limits";

/** Checks used this week. */
export const TRIES_COOKIE = "mly_ckk";
/** Set once the visitor has rated the tool, so they're not asked again. */
export const RATING_COOKIE = "mly_rated";
/** Set when the offer is dismissed at the limit. */
export const OFFER_DISMISSED_COOKIE = "mly_disc_dismissed";

export function readCookie(cookies: string, name: string): string | undefined {
  const pair = cookies.split(/;\s*/).find((cookie) => cookie.startsWith(`${name}=`));
  return pair?.slice(name.length + 1);
}

export const hasCookie = (cookies: string, name: string) => readCookie(cookies, name) !== undefined;

/** A missing or garbled count is zero rather than blocking a genuine visitor. */
export function readFreeTries(cookies: string): number {
  const value = Number.parseInt(readCookie(cookies, TRIES_COOKIE) ?? "", 10);
  return Number.isFinite(value) && value > 0 ? Math.min(value, FREE_CHECK_WEEKLY_LIMIT) : 0;
}

/** Midnight at the start of next Monday, when the weekly allowance resets. */
export function nextMondayMidnight(now = new Date()): Date {
  const next = new Date(now.getTime());
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7) + 7);
  next.setHours(0, 0, 0, 0);
  return next;
}

export const remainingChecks = (tries: number) => Math.max(0, FREE_CHECK_WEEKLY_LIMIT - tries);
export const hasReachedLimit = (tries: number) => tries >= FREE_CHECK_WEEKLY_LIMIT;

/**
 * Which prompt, if any, follows a successful check: the rating on exactly
 * the third, the trial offer from the eighth. Each stops once answered.
 */
export function promptAfterCheck(
  tries: number,
  { alreadyRated = false, offerDismissed = false } = {},
): "rating" | "offer" | null {
  if (tries === FREE_CHECK_RATING_AT && !alreadyRated) return "rating";
  if (tries >= FREE_CHECK_OFFER_FROM && !offerDismissed) return "offer";
  return null;
}

export function triesCookie(tries: number, now = new Date()): string {
  return `${TRIES_COOKIE}=${tries}; Path=/; Expires=${nextMondayMidnight(now).toUTCString()}; SameSite=Lax`;
}
