"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getKeyValue } from "@/lib/aws/apiKeys";
import { canManageBilling, canSeeKey } from "@/lib/billing/permissions";
import { canRotateKey, rotateKey } from "@/lib/billing/rotate-key";
import { rotateKeyDeps } from "@/lib/billing/rotate-key-server";
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
// Each product has its own key: the EISCD key is separate (plan §6.7).
export async function revealApiKey(
  product: "bank_checker" | "eiscd" = "bank_checker",
): Promise<RevealState> {
  const user = await requireUser("/subscription");
  if (!canSeeKey(user.membership)) return { error: "You can't view the API key." };
  if (product !== "bank_checker" && product !== "eiscd") return { error: "No such product." };

  const { current } = await getOrgSubscriptions(user.membership!.orgId);
  const sub = current.find((s) => s.product === product);
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

export type RotateState = { error?: string; message?: string };

// KEY-01: owners and developers replace the key, now or with a 24-hour overlap.
export async function rotateApiKey(_state: RotateState, formData: FormData): Promise<RotateState> {
  const user = await requireUser("/subscription");
  const membership = user.membership;
  if (!membership || !canRotateKey(membership)) return { error: "You can't rotate the API key." };
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  const when = formData.get("when") === "now" ? "now" : "overlap";
  try {
    const result = await rotateKey(
      rotateKeyDeps(),
      {
        id: user.id,
        email: user.email,
        role: membership.role,
        orgId: membership.orgId,
        orgName: membership.orgName,
        reviewStatus: membership.reviewStatus,
      },
      when,
    );
    refresh();
    return result.ok ? { message: result.message } : { error: result.error };
  } catch (error) {
    console.error("key rotation failed", error);
    return {
      error: `We couldn't replace your key. Your current key still works. Email ${siteConfig.supportEmail} if this keeps happening.`,
    };
  }
}
