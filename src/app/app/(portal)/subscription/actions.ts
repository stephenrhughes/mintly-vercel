"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getKeyValue } from "@/lib/aws/apiKeys";
import { canManageBilling, canSeeKey } from "@/lib/billing/permissions";
import { getOrgSubscriptions } from "@/lib/billing/queries";
import { describeSubscription } from "@/lib/billing/status";
import { appUrl } from "@/lib/hosts";
import { siteConfig } from "@/lib/site";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RevealState = { value?: string; error?: string };

// SUB-02, SUB-03: the API key value, read from API Gateway on demand. Only
// owners and developers of an approved organisation get it, and only while
// the subscription is active; it is never stored or put in the page HTML.
export async function revealApiKey(): Promise<RevealState> {
  const user = await requireUser("/subscription");
  if (!canSeeKey(user.membership)) return { error: "You can't view the API key." };

  const { current } = await getOrgSubscriptions(user.membership!.orgId);
  const sub = current.find((s) => s.product === "bank_checker") ?? current[0];
  if (!sub?.apiKeyId || !describeSubscription(sub).active) {
    return { error: "Your subscription has no active API key." };
  }

  try {
    const value = await getKeyValue(sub.apiKeyId);
    return value
      ? { value }
      : { error: `We couldn't find your key. Email ${siteConfig.supportEmail}.` };
  } catch (error) {
    console.error("reading the key value failed", error);
    return { error: "We couldn't load your key. Please try again." };
  }
}

export type PortalState = { error?: string };

// BILL-01: the Stripe billing portal, for the owner only.
export async function openBillingPortal(): Promise<PortalState> {
  const user = await requireUser("/subscription");
  if (!canManageBilling(user.membership)) {
    return { error: "Only your account owner can manage billing." };
  }
  const stripe = getStripe();
  if (!stripe) return { error: "Billing isn't available on this deployment yet." };

  // Read as the user, so RLS confirms the customer is their organisation's.
  const supabase = await createClient();
  const { data } = await supabase
    .from("organisations")
    .select("stripe_customer_id")
    .eq("id", user.membership!.orgId)
    .maybeSingle<{ stripe_customer_id: string | null }>();
  if (!data?.stripe_customer_id) return { error: "Your organisation has no billing account yet." };

  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: appUrl("/subscription"),
  });
  redirect(session.url);
}

// BILL-08: hide the "you have a new key" notice once someone has read it.
export async function dismissKeyNotice(): Promise<void> {
  const user = await requireUser("/subscription");
  if (!canSeeKey(user.membership)) return;

  // Users can't write subscriptions; the server does, for their own organisation only.
  const { error } = await createServiceClient()
    .from("subscriptions")
    .update({ key_notice_dismissed_at: new Date().toISOString() })
    .eq("org_id", user.membership!.orgId)
    .not("key_notice_at", "is", null)
    .is("key_notice_dismissed_at", null);
  if (error) console.error("dismissing the key notice failed", error.message);
  refresh();
}
