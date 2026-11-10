import "server-only";

import { syncSubscription } from "@/lib/billing/provision";
import { provisionDeps } from "@/lib/billing/server";
import { priceMeta } from "@/lib/billing/subscription-record";
import { requireStripe } from "@/lib/stripe/client";
import { createCustomPrice } from "@/lib/stripe/custom-price";
import { createServiceClient } from "@/lib/supabase/admin";
import { inviteOwner } from "@/lib/team/operations";
import { teamDeps } from "@/lib/team/server";

import { auditSink } from "./audit";
import type { CustomerSetupDeps } from "./customer-setup";
import type { OfferDeps, OfferRow } from "./offers";

// Wires customer set-up (ADM-12) and offers (ADM-11) to Stripe, Supabase and
// the team invites. Callers have already passed requireAdmin().

function isMissing(error: unknown) {
  const e = error as { statusCode?: number; code?: string } | null;
  return e?.statusCode === 404 || e?.code === "resource_missing";
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

export function customerSetupDeps(admin: { id: string; email: string }): CustomerSetupDeps {
  const db = createServiceClient();
  const stripe = requireStripe();
  return {
    async isBlockedDomain(domain) {
      const { count, error } = await db
        .from("blocked_domains")
        .select("domain", { count: "exact", head: true })
        .eq("domain", domain);
      if (error) fail("checking blocked domains", error);
      return (count ?? 0) > 0;
    },
    async existingOrganisationOf(email) {
      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle<{ id: string }>();
      if (!profile) return null;
      const { data } = await db
        .from("memberships")
        .select("organisations (name)")
        .eq("user_id", profile.id)
        .maybeSingle<{ organisations: { name: string } | null }>();
      return data?.organisations?.name ?? null;
    },
    stripe: {
      async getPrice(id) {
        try {
          const price = await stripe.prices.retrieve(id);
          return {
            id: price.id,
            product: priceMeta(price).product,
            active: price.active,
            recurring: Boolean(price.recurring),
          };
        } catch (error) {
          if (isMissing(error)) return null;
          throw error;
        }
      },
      async createCustomer({ name, email, idempotencyKey }) {
        const customer = await stripe.customers.create(
          { name, email, metadata: { createdBy: "admin" } },
          { idempotencyKey },
        );
        return customer.id;
      },
      createCustomPrice,
      async createSubscription({
        customerId,
        priceId,
        billing,
        daysUntilDue,
        trialDays,
        metadata,
        idempotencyKey,
      }) {
        const sub = await stripe.subscriptions.create(
          {
            customer: customerId,
            items: [{ price: priceId }],
            metadata,
            ...(trialDays > 0
              ? {
                  trial_period_days: trialDays,
                  // As self-serve trials: no card by the end, no subscription.
                  ...(billing === "card"
                    ? { trial_settings: { end_behavior: { missing_payment_method: "cancel" } } }
                    : {}),
                }
              : {}),
            ...(billing === "invoice"
              ? { collection_method: "send_invoice", days_until_due: daysUntilDue }
              : { collection_method: "charge_automatically" }),
          },
          { idempotencyKey },
        );
        return sub.id;
      },
    },
    async createOrganisation({ name, stripeCustomerId, actorId, details }) {
      const { data, error } = await db.rpc("create_admin_organisation", {
        p_name: name,
        p_stripe_customer_id: stripeCustomerId,
        p_actor_id: actorId,
        p_details: details,
      });
      if (error) fail("creating the organisation", error);
      return String(data);
    },
    async syncSubscription(subscriptionId) {
      await syncSubscription(provisionDeps(), subscriptionId, null);
    },
    inviteOwner: ({ orgId, orgName, email }) =>
      inviteOwner(teamDeps(), {
        actor: { id: admin.id, email: admin.email, name: "Mintly" },
        org: { orgId, orgName, reviewStatus: "approved" },
        email,
      }),
    audit: auditSink(db),
  };
}

type OfferDbRow = {
  id: string;
  org_id: string | null;
  email: string | null;
  stripe_price_id: string;
  headline: string;
  message: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const OFFER_COLUMNS =
  "id, org_id, email, stripe_price_id, headline, message, expires_at, accepted_at, revoked_at, created_at";

const toOffer = (row: OfferDbRow): OfferRow => ({
  id: row.id,
  orgId: row.org_id,
  email: row.email,
  stripePriceId: row.stripe_price_id,
  headline: row.headline,
  message: row.message,
  expiresAt: new Date(row.expires_at),
  acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
  revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
  createdAt: new Date(row.created_at),
});

export function offerDeps(): OfferDeps {
  const db = createServiceClient();
  return {
    async orgExists(orgId) {
      const { count, error } = await db
        .from("organisations")
        .select("id", { count: "exact", head: true })
        .eq("id", orgId);
      if (error) fail("reading the organisation", error);
      return (count ?? 0) > 0;
    },
    async priceExists(priceId) {
      try {
        await requireStripe().prices.retrieve(priceId);
        return true;
      } catch (error) {
        if (isMissing(error)) return false;
        throw error;
      }
    },
    createCustomPrice,
    async insert(row) {
      const { data, error } = await db
        .from("offers")
        .insert({
          org_id: row.orgId,
          email: row.email,
          stripe_price_id: row.stripePriceId,
          headline: row.headline,
          message: row.message,
          expires_at: row.expiresAt.toISOString(),
          created_by: row.createdBy,
        })
        .select("id")
        .single<{ id: string }>();
      if (error) fail("saving the offer", error);
      return data.id;
    },
    async get(offerId) {
      const { data, error } = await db
        .from("offers")
        .select(OFFER_COLUMNS)
        .eq("id", offerId)
        .maybeSingle<OfferDbRow>();
      if (error) fail("reading the offer", error);
      return data ? toOffer(data) : null;
    },
    async revoke(offerId) {
      const { data, error } = await db
        .from("offers")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", offerId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .select("id");
      if (error) fail("withdrawing the offer", error);
      return data.length > 0;
    },
    audit: auditSink(db),
  };
}

export type OfferListItem = OfferRow & { orgName: string | null; createdBy: string | null };

export async function listOffers(): Promise<OfferListItem[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("offers")
    .select(`${OFFER_COLUMNS}, created_by, organisations (name)`)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<
      Array<OfferDbRow & { created_by: string | null; organisations: { name: string } | null }>
    >();
  if (error) fail("reading offers", error);
  const ids = [...new Set(data.flatMap((r) => (r.created_by ? [r.created_by] : [])))];
  const { data: people } = ids.length
    ? await db
        .from("profiles")
        .select("id, email")
        .in("id", ids)
        .returns<Array<{ id: string; email: string }>>()
    : { data: [] as Array<{ id: string; email: string }> };
  const emailOf = new Map((people ?? []).map((p) => [p.id, p.email]));
  return data.map((r) => ({
    ...toOffer(r),
    orgName: r.organisations?.name ?? null,
    createdBy: r.created_by ? (emailOf.get(r.created_by) ?? null) : null,
  }));
}
