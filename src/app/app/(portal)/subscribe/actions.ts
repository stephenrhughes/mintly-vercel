"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { blockingSubscription, findBuyer, isBlockedDomain } from "@/lib/billing/checkout";
import { type BlockingSubscription, checkoutSessionParams } from "@/lib/billing/checkout-params";
import { PLAN_INTENT_COOKIE } from "@/lib/billing/plan-intent";
import { planNameFor } from "@/lib/billing/queries";
import { isBillingInterval, isPlanTier, PLANS } from "@/lib/billing/plans";
import { appUrl } from "@/lib/hosts";
import { requestSignals } from "@/lib/review/request-signals";
import { mayCheckOut } from "@/lib/review/rules";
import { siteConfig } from "@/lib/site";
import { getPlanPrice } from "@/lib/stripe/catalogue";
import { getStripe } from "@/lib/stripe/client";

export type CheckoutState = {
  error?: string;
  /** BUY-05: the customer already has a live subscription. */
  blocked?: BlockingSubscription & { planName: string | null };
};

const support = `Email ${siteConfig.supportEmail} and we'll sort it out.`;

// BUY-01 to BUY-05: start Stripe Checkout for a self-serve plan.
export async function startCheckout(
  _state: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const user = await requireUser("/subscribe");
  const tier = formData.get("tier");
  const interval = formData.get("interval");
  if (!isPlanTier(tier) || !isBillingInterval(interval)) {
    return { error: "Choose a plan." };
  }

  const stripe = getStripe();
  if (!stripe) return { error: `Checkout isn't available on this deployment yet. ${support}` };

  // Only the owner buys for an organisation (BILL-01, plan §3).
  if (user.membership && user.membership.role !== "owner") {
    return { error: "Only your account owner can choose a plan." };
  }
  // A declined or suspended organisation can't start again here, and nor
  // can a blocked domain (plan §6.11). The wording gives no reason.
  if (!mayCheckOut(user.membership?.reviewStatus ?? null) || (await isBlockedDomain(user.email))) {
    return { error: `We can't start a subscription for your account. ${support}` };
  }

  const buyer = await findBuyer(user);
  if (buyer.kind === "other_org") {
    return {
      error: `Your email address is already linked to a Mintly customer account. ${support}`,
    };
  }
  const stripeCustomerId = buyer.kind === "returning" ? buyer.stripeCustomerId : null;

  if (stripeCustomerId) {
    const blocking = await blockingSubscription(stripeCustomerId);
    if (blocking) {
      const planName = blocking.priceId ? await planNameFor(blocking.priceId) : null;
      return { blocked: { ...blocking, planName } };
    }
  }

  const price = await getPlanPrice(tier, interval);
  if (!price) {
    return {
      error: `${PLANS[tier].name} isn't available ${interval === "annual" ? "annually" : "monthly"} right now. ${support}`,
    };
  }

  const session = await stripe.checkout.sessions.create(
    checkoutSessionParams({
      priceId: price.id,
      userId: user.id,
      email: user.email,
      stripeCustomerId,
      signals: { ...requestSignals(await headers()) },
      successUrl: appUrl("/welcome?session_id={CHECKOUT_SESSION_ID}"),
      cancelUrl: appUrl(`/subscribe?plan=${tier}&interval=${interval}`),
    }),
  );
  if (!session.url) return { error: `We couldn't start checkout. ${support}` };

  (await cookies()).delete(PLAN_INTENT_COOKIE);
  redirect(session.url);
}
