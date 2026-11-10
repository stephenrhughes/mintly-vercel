import "server-only";

import { cacheLife } from "next/cache";

import { planLabel } from "@/lib/billing/plan-name";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/admin";

import type { ReportOrg, ReportSubscription, RevenueLine, ReviewDecision } from "./reports";

// Loads the business dashboard (ADM-14). The database figures are read
// fresh; recurring revenue comes from Stripe and is cached for a day.
// Callers have already passed requireAdmin().

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

const AUTO_DECISIONS = new Set([
  "trusted_domain",
  "approved_org_domain",
  "sso_domain",
  "admin_setup",
]);

export type ReportData = {
  signUps: Date[];
  orgs: ReportOrg[];
  decisions: ReviewDecision[];
  subscriptions: ReportSubscription[];
  pendingReviews: number;
};

export async function loadReportData(since: Date): Promise<ReportData> {
  const db = createServiceClient();
  const iso = since.toISOString();
  const [profiles, orgs, decisions, subs] = await Promise.all([
    db
      .from("profiles")
      .select("created_at")
      .eq("is_mintly_admin", false)
      .gte("created_at", iso)
      .limit(50_000)
      .returns<Array<{ created_at: string }>>(),
    db
      .from("organisations")
      .select(
        "created_at, review_status, reviewed_at, ended_at, cancellation_reason, signup_signals",
      )
      .limit(50_000)
      .returns<
        Array<{
          created_at: string;
          review_status: ReportOrg["reviewStatus"];
          reviewed_at: string | null;
          ended_at: string | null;
          cancellation_reason: string | null;
          signup_signals: { decision?: string } | null;
        }>
      >(),
    db
      .from("admin_audit")
      .select("at, action")
      .in("action", ["review.approve", "review.decline", "review.expire"])
      .gte("at", iso)
      .limit(50_000)
      .returns<Array<{ at: string; action: string }>>(),
    db
      .from("subscriptions")
      .select("product, status, trialing, expired, trial_end")
      .limit(50_000)
      .returns<
        Array<{
          product: ReportSubscription["product"];
          status: string;
          trialing: boolean;
          expired: boolean;
          trial_end: string | null;
        }>
      >(),
  ]);
  if (profiles.error) fail("reading sign-ups", profiles.error);
  if (orgs.error) fail("reading organisations", orgs.error);
  if (decisions.error) fail("reading review decisions", decisions.error);
  if (subs.error) fail("reading subscriptions", subs.error);

  return {
    signUps: profiles.data.map((p) => new Date(p.created_at)),
    orgs: orgs.data.map((o) => ({
      createdAt: new Date(o.created_at),
      reviewStatus: o.review_status,
      reviewedAt: o.reviewed_at ? new Date(o.reviewed_at) : null,
      autoApproved: AUTO_DECISIONS.has(o.signup_signals?.decision ?? ""),
      endedAt: o.ended_at ? new Date(o.ended_at) : null,
      cancellationReason: o.cancellation_reason,
    })),
    decisions: decisions.data.map((d) => ({
      at: new Date(d.at),
      action: d.action.replace("review.", "") as ReviewDecision["action"],
    })),
    subscriptions: subs.data.map((s) => ({
      product: s.product,
      status: s.status,
      trialing: s.trialing,
      expired: s.expired,
      trialEnd: s.trial_end ? new Date(s.trial_end) : null,
    })),
    pendingReviews: orgs.data.filter((o) => o.review_status === "pending_review").length,
  };
}

/**
 * Live paid subscriptions from Stripe, one line per subscription item.
 * Cached for a day (plan §6.8: "from Stripe, cached daily"); null without
 * Stripe.
 */
export async function loadRevenueLines(): Promise<{ lines: RevenueLine[]; at: string } | null> {
  "use cache";
  cacheLife("days");
  const stripe = getStripe();
  if (!stripe) return null;
  const lines: RevenueLine[] = [];
  for (const status of ["active", "past_due"] as const) {
    for await (const sub of stripe.subscriptions.list({ status, limit: 100 })) {
      for (const item of sub.items.data) {
        lines.push({
          planName: planLabel(item.price),
          unitAmount: item.price.unit_amount,
          quantity: item.quantity ?? 1,
          interval: item.price.recurring?.interval ?? null,
          intervalCount: item.price.recurring?.interval_count ?? 1,
          currency: item.price.currency,
        });
      }
    }
  }
  return { lines, at: new Date().toISOString() };
}
