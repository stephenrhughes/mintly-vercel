import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { canManageBilling } from "@/lib/billing/permissions";
import { adoptAddedCard } from "@/lib/billing/plan-change-server";
import { isBillingInterval, isPlanTier } from "@/lib/billing/plans";
import { appPath } from "@/lib/hosts";

// Where Stripe returns after an owner adds a card to start paying (PLAN-03).
// It makes the card the default, then sends the owner back to confirm the
// quoted plan. Nothing is charged here.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tier = url.searchParams.get("tier");
  const interval = url.searchParams.get("interval");
  const sessionId = url.searchParams.get("session_id") ?? "";
  const back = (query: string) =>
    NextResponse.redirect(new URL(appPath(`/subscription/change${query}`), request.url));

  const user = await requireUser("/subscription/change");
  if (!canManageBilling(user.membership) || !isPlanTier(tier) || !isBillingInterval(interval)) {
    return back("");
  }
  const plan = `?tier=${tier}&interval=${interval}&mode=start_paid`;
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return back(plan);

  try {
    const ok = await adoptAddedCard({ orgId: user.membership!.orgId, sessionId });
    return back(`${plan}${ok ? "&card=added" : "&card=failed"}`);
  } catch (error) {
    console.error("using the added card failed", error);
    return back(`${plan}&card=failed`);
  }
}
