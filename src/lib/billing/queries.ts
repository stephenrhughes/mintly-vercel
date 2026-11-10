import "server-only";

import { getPrice } from "@/lib/stripe/catalogue";
import { getStripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

import { planLabel } from "./plan-name";
import type { SubscriptionView } from "./status";

// Reading an organisation's subscriptions as the signed-in user, so RLS
// limits it to their own organisation (SUB-05).

type Row = {
  id: string;
  product: "bank_checker" | "eiscd";
  stripe_price_id: string;
  status: string;
  trialing: boolean;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  expired: boolean;
  max_team_size: number | null;
  extra_users: number;
  api_key_id: string | null;
  key_notice_at: string | null;
  key_notice_dismissed_at: string | null;
  created_at: string;
  api_keys: { enabled: boolean } | null;
};

const date = (value: string | null) => (value ? new Date(value) : null);

function toView(row: Row): SubscriptionView {
  return {
    id: row.id,
    product: row.product,
    stripePriceId: row.stripe_price_id,
    status: row.status,
    trialing: row.trialing,
    trialEnd: date(row.trial_end),
    currentPeriodEnd: date(row.current_period_end),
    cancelAt: date(row.cancel_at),
    expired: row.expired,
    maxTeamSize: row.max_team_size,
    extraUsers: row.extra_users,
    apiKeyId: row.api_key_id,
    keyEnabled: row.api_keys?.enabled ?? false,
    keyNoticeAt: date(row.key_notice_at),
    keyNoticeDismissedAt: date(row.key_notice_dismissed_at),
  };
}

export type OrgSubscriptions = {
  /** The live subscription for each product, or else the most recent one. */
  current: SubscriptionView[];
  /** Whether the organisation has had a subscription before (SUB-06). */
  hasHistory: boolean;
};

export async function getOrgSubscriptions(orgId: string): Promise<OrgSubscriptions> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, product, stripe_price_id, status, trialing, trial_end, current_period_end, cancel_at, expired, max_team_size, extra_users, api_key_id, key_notice_at, key_notice_dismissed_at, created_at, api_keys (enabled)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error) {
    console.error("reading subscriptions failed", error.code, error.message);
    return { current: [], hasHistory: false };
  }

  const current: SubscriptionView[] = [];
  for (const product of ["bank_checker", "eiscd"] as const) {
    const rows = data.filter((row) => row.product === product);
    const pick = rows.find((row) => !row.expired) ?? rows[0];
    if (pick) current.push(toView(pick));
  }
  return { current, hasHistory: data.length > 0 };
}

/** The plan's display name, from the price's tier metadata (SUB-01). */
export async function planNameFor(priceId: string): Promise<string> {
  if (!getStripe()) return "Bank Account Checker";
  try {
    const price = await getPrice(priceId);
    return planLabel(price);
  } catch (error) {
    console.error("reading the price failed", priceId, error);
    return "Bank Account Checker";
  }
}
