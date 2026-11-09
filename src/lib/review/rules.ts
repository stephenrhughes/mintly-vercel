// Trial review rules (plan §6.11, APPR-*), as pure functions.

import type { ReviewStatus } from "@/lib/nav";

/** Pending reviews are declined automatically after this many days (APPR-07). */
export const REVIEW_EXPIRY_DAYS = 7;

/** Admins are reminded after this much working time (plan: 4 working hours). */
export const REVIEW_REMINDER_WORKING_MINUTES = 4 * 60;

export type AutoApproveReason = "trusted_domain" | "approved_org_domain" | "sso_domain";

export type ReviewDecision =
  | { status: "approved"; reason: AutoApproveReason }
  | { status: "pending_review"; reason: "needs_review" };

/**
 * Whether a new trial organisation is approved straight away (APPR-02).
 * Card details play no part: trials take no card. Joining an approved
 * organisation and admin-created subscriptions never reach this, because
 * neither creates a new trial organisation through checkout.
 */
export function decideReview(input: {
  trustedDomain: boolean;
  approvedOrgDomain: boolean;
  ssoDomain: boolean;
}): ReviewDecision {
  if (input.trustedDomain) return { status: "approved", reason: "trusted_domain" };
  if (input.approvedOrgDomain) return { status: "approved", reason: "approved_org_domain" };
  if (input.ssoDomain) return { status: "approved", reason: "sso_domain" };
  return { status: "pending_review", reason: "needs_review" };
}

/** Whether a customer with this review status may start a checkout (plan §6.11). */
export function mayCheckOut(status: ReviewStatus | null): boolean {
  return status !== "rejected" && status !== "suspended";
}

/** Normalises an email domain or host name; null if it isn't one. */
export function normaliseDomain(value: string | null | undefined): string | null {
  const domain = (value ?? "").trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

// Two-part public suffixes common among Mintly's customers. Not the full
// public suffix list: this only feeds a hint for a human reviewer.
const TWO_PART_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ltd.uk",
  "plc.uk",
  "me.uk",
  "ac.uk",
  "gov.uk",
  "nhs.uk",
  "net.uk",
  "sch.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "co.za",
  "com.br",
  "co.in",
  "co.jp",
  "com.sg",
  "com.hk",
]);

/** The name part of a domain: "acme" for mail.acme.co.uk. */
export function registrableLabel(domain: string): string {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  if (labels.length < 2) return labels[0] ?? "";
  const lastTwo = labels.slice(-2).join(".");
  const index =
    TWO_PART_SUFFIXES.has(lastTwo) && labels.length >= 3 ? labels.length - 3 : labels.length - 2;
  return labels[index];
}

const COMPANY_SUFFIXES =
  /\b(ltd|limited|plc|llp|llc|inc|incorporated|group|holdings|uk|the|co|company|corp|corporation|gmbh|bv|sa)\b/g;

const squash = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(COMPANY_SUFFIXES, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Whether the company name entered looks like the email domain (APPR-04):
 * "Acme Widgets Ltd" and acme-widgets.co.uk, or "ACME" and acme.com. A hint
 * for the reviewer, never a decision on its own.
 */
export function companyMatchesDomain(company: string | null | undefined, domain: string): boolean {
  const name = squash(company ?? "");
  const label = registrableLabel(domain).replace(/[^a-z0-9]/g, "");
  if (name.length < 2 || label.length < 2) return false;
  if (name === label || name.includes(label) || label.includes(name)) return true;
  // Initials: "International Business Machines" and ibm.com.
  const initials = (company ?? "")
    .toLowerCase()
    .replace(COMPANY_SUFFIXES, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
  return initials.length >= 2 && initials === label;
}

// Working time for the review reminder: Monday to Friday, 9:00 to 17:30 UK
// time. Bank holidays aren't excluded; a reminder on one is harmless.
const DAY_START = 9 * 60;
const DAY_END = 17 * 60 + 30;
const STEP_MINUTES = 5;

const londonParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function isWorkingMinute(date: Date): boolean {
  const parts = Object.fromEntries(londonParts.formatToParts(date).map((p) => [p.type, p.value]));
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return false;
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return minute >= DAY_START && minute < DAY_END;
}

/** Working minutes between two times, counted in 5-minute steps. */
export function workingMinutesBetween(from: Date, to: Date): number {
  let minutes = 0;
  for (let t = from.getTime(); t < to.getTime(); t += STEP_MINUTES * 60_000) {
    if (isWorkingMinute(new Date(t))) minutes += STEP_MINUTES;
  }
  return minutes;
}

/** Whether a review waiting since `since` needs a reminder by `now`. */
export function reviewIsOverdue(since: Date, now: Date): boolean {
  return workingMinutesBetween(since, now) >= REVIEW_REMINDER_WORKING_MINUTES;
}

/** Whether a review waiting since `since` has expired by `now` (APPR-07). */
export function reviewHasExpired(since: Date, now: Date): boolean {
  return now.getTime() - since.getTime() >= REVIEW_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}

/** "3 hours", "2 days": how long a review has waited, for the queue. */
export function waitingFor(since: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "1 minute" : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${Math.floor(hours / 24)} days`;
}
