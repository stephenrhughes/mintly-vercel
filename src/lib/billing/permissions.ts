// Who may do what with the subscription (plan §3 role matrix).

import type { OrgRole, ReviewStatus } from "@/lib/nav";

type Who = { role: OrgRole; reviewStatus: ReviewStatus } | null;

/**
 * View and copy the API key: owners and developers, once the organisation
 * is approved (SUB-03, APPR-01). Members never see it (plan §3, Q1).
 */
export function canSeeKey(who: Who): boolean {
  return Boolean(who && who.role !== "member" && who.reviewStatus === "approved");
}

/** The Stripe billing portal: the owner only (BILL-01). */
export function canManageBilling(who: Who): boolean {
  return who?.role === "owner";
}
