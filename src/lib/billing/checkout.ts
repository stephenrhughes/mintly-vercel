import "server-only";

import { cache } from "react";

import type { AppUser } from "@/lib/auth/session";
import { requireStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/admin";

import { type BlockingSubscription, findBlockingSubscription } from "./checkout-params";

// Who is buying, for checkout (BUY-04, BUY-05).

export type Buyer =
  | { kind: "new" }
  | { kind: "returning"; stripeCustomerId: string }
  /** The Stripe customer belongs to an organisation this user isn't the owner of. */
  | { kind: "other_org" };

/**
 * The buyer's Stripe customer: their organisation's, or one Stripe holds for
 * their email (a returning customer, BUY-04). Read with the service role,
 * because a returning customer's old organisation may no longer be theirs.
 */
export const findBuyer = cache(async (user: AppUser): Promise<Buyer> => {
  const db = createServiceClient();

  if (user.membership) {
    const { data, error } = await db
      .from("organisations")
      .select("stripe_customer_id")
      .eq("id", user.membership.orgId)
      .single<{ stripe_customer_id: string | null }>();
    if (error) throw new Error(`reading the organisation failed: ${error.message}`);
    return data.stripe_customer_id
      ? { kind: "returning", stripeCustomerId: data.stripe_customer_id }
      : { kind: "new" };
  }

  const stripe = requireStripe();
  const { data: customers } = await stripe.customers.list({ email: user.email, limit: 10 });
  const customer = customers.find((c) => !c.deleted);
  if (!customer) return { kind: "new" };

  // A customer whose organisation still exists, without this user in it,
  // can't be bought for from here: support sorts out who owns it.
  const { data: org, error } = await db
    .from("organisations")
    .select("id")
    .eq("stripe_customer_id", customer.id)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(`finding the customer's organisation failed: ${error.message}`);
  return org ? { kind: "other_org" } : { kind: "returning", stripeCustomerId: customer.id };
});

/** The customer's live subscription in Stripe, which blocks checkout (BUY-05). */
export async function blockingSubscription(
  stripeCustomerId: string,
): Promise<BlockingSubscription | null> {
  const { data } = await requireStripe().subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 20,
  });
  return findBlockingSubscription(data);
}
