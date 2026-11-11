// The public free checker's limits (FREE-03, FREE-04, plan §6.9). Shared by
// the server (the database enforces them) and the page (which explains them).

/** Checks per IP address per week; the week resets on Monday. */
export const FREE_CHECK_WEEKLY_LIMIT = 10;
/** The least time between two checks from one IP address. */
export const FREE_CHECK_MIN_INTERVAL_SECONDS = 2;
/** Ask for a rating after this many successful checks (once). */
export const FREE_CHECK_RATING_AT = 3;
/** Offer a discount from this many checks. */
export const FREE_CHECK_OFFER_FROM = 8;
