import "server-only";

import type Stripe from "stripe";

import { PlanChangedEmail } from "@/emails/plan-change";
import {
  liveSubscriptionFrom,
  ownerEmail,
  supabasePlanChangeRecords,
} from "@/lib/billing/plan-change-server";
import { planLabel } from "@/lib/billing/plan-name";
import { syncSubscription } from "@/lib/billing/provision";
import { provisionDeps } from "@/lib/billing/server";
import { priceMeta } from "@/lib/billing/subscription-record";
import { sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/hosts";
import { requireStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/admin";

import { auditSink } from "./audit";
import type {
  AdminPrice,
  AdminSubscriptionContext,
  AdminSubscriptionDeps,
  AdminSubscriptionStripe,
  TrialEndChange,
} from "./subscription-changes";

// Wires admin subscription changes (PLAN-09) to Stripe, Supabase and email.
// Callers have already passed requireAdmin().

const unix = (date: Date) => Math.floor(date.getTime() / 1000);

function trialParam(trialEnd: TrialEndChange): { trial_end?: "now" | number } {
  if (trialEnd === null) return {};
  return { trial_end: trialEnd === "now" ? "now" : unix(trialEnd) };
}

function isMissing(error: unknown) {
  const e = error as { statusCode?: number; code?: string } | null;
  return e?.statusCode === 404 || e?.code === "resource_missing";
}

const isInterval = (value: string): value is "day" | "week" | "month" | "year" =>
  ["day", "week", "month", "year"].includes(value);

export function toAdminPrice(price: Stripe.Price): AdminPrice {
  const meta = priceMeta(price);
  return {
    id: price.id,
    name: planLabel(price),
    active: price.active,
    unitAmount: price.unit_amount,
    currency: price.currency,
    recurring:
      price.recurring && isInterval(price.recurring.interval)
        ? { interval: price.recurring.interval, count: price.recurring.interval_count }
        : null,
    product: meta.product,
    maxTeamSize: meta.maxTeamSize,
  };
}

function adminStripe(stripe: Stripe): AdminSubscriptionStripe {
  return {
    async getSubscription(id) {
      const sub = await stripe.subscriptions.retrieve(id, { expand: ["customer"] });
      const live = liveSubscriptionFrom(sub);
      return {
        ...live,
        product: priceMeta(sub.items.data[0]?.price).product,
        extraUsers: Number.parseInt(sub.metadata?.extraUsers ?? "0", 10) || 0,
      };
    },
    async getPrice(id) {
      try {
        return toAdminPrice(await stripe.prices.retrieve(id));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async preview({ sub, priceId, trialEnd, proration, prorationDate }) {
      const preview = await stripe.invoices.createPreview({
        customer: sub.customerId,
        subscription: sub.id,
        subscription_details: {
          items: [{ id: sub.itemId, price: priceId }],
          proration_behavior: proration,
          ...(proration === "none" ? {} : { proration_date: prorationDate }),
          ...trialParam(trialEnd),
        },
      });
      return { amountDue: preview.amount_due, currency: preview.currency };
    },
    async updateNow({ sub, priceId, trialEnd, proration, prorationDate, idempotencyKey }) {
      const updated = await stripe.subscriptions.update(
        sub.id,
        {
          items: [{ id: sub.itemId, price: priceId }],
          proration_behavior: proration,
          ...(proration === "none" ? {} : { proration_date: prorationDate }),
          ...trialParam(trialEnd),
          expand: ["latest_invoice"],
        },
        { idempotencyKey },
      );
      const invoice = updated.latest_invoice as Stripe.Invoice | null;
      return {
        amountCharged: proration === "always_invoice" ? (invoice?.amount_due ?? null) : null,
      };
    },
    async scheduleAtRenewal({ sub, price, idempotencyKey }) {
      // The rest of this period on the current price, then the new one,
      // through a schedule that releases afterwards (as PLAN-04 does).
      const schedule = await stripe.subscriptionSchedules.create(
        { from_subscription: sub.id },
        { idempotencyKey: `${idempotencyKey}-create` },
      );
      const phase = schedule.phases[0];
      await stripe.subscriptionSchedules.update(
        schedule.id,
        {
          end_behavior: "release",
          proration_behavior: "none",
          phases: [
            {
              items: [{ price: sub.priceId }],
              start_date: phase.start_date,
              end_date: phase.end_date,
            },
            {
              items: [{ price: price.id }],
              duration: {
                interval: price.recurring?.interval ?? "month",
                interval_count: price.recurring?.count ?? 1,
              },
            },
          ],
        },
        { idempotencyKey: `${idempotencyKey}-update` },
      );
      return { scheduleId: schedule.id };
    },
    async releaseSchedule(scheduleId) {
      try {
        await stripe.subscriptionSchedules.release(scheduleId);
      } catch (error) {
        if (!isMissing(error) && !String(error).includes("released")) throw error;
      }
    },
    async setExtraUsers(subscriptionId, extraUsers, idempotencyKey) {
      await stripe.subscriptions.update(
        subscriptionId,
        { metadata: { extraUsers: String(extraUsers) } },
        { idempotencyKey },
      );
    },
    async setTrialEnd(subscriptionId, trialEnd, idempotencyKey) {
      await stripe.subscriptions.update(
        subscriptionId,
        { trial_end: unix(trialEnd), proration_behavior: "none" },
        { idempotencyKey },
      );
    },
    async cancel(subscriptionId, when, idempotencyKey) {
      if (when === "now") {
        await stripe.subscriptions.cancel(
          subscriptionId,
          { cancellation_details: { comment: "Cancelled by Mintly" } },
          { idempotencyKey },
        );
      } else {
        await stripe.subscriptions.update(
          subscriptionId,
          { cancel_at_period_end: true },
          { idempotencyKey },
        );
      }
    },
    async undoCancel(subscriptionId) {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
    },
  };
}

export function adminSubscriptionDeps(): AdminSubscriptionDeps {
  const db = createServiceClient();
  return {
    stripe: adminStripe(requireStripe()),
    records: supabasePlanChangeRecords(),
    async syncSubscription(subscriptionId) {
      await syncSubscription(provisionDeps(), subscriptionId, null);
    },
    async notifyOwner(input) {
      const to = await ownerEmail(input.orgId);
      if (!to) return;
      const later = input.effectiveAt.getTime() > Date.now() + 60_000;
      await sendEmail({
        to,
        subject: later
          ? `Your Mintly plan will change to the ${input.planName}`
          : `Your Mintly plan is now the ${input.planName}`,
        react: PlanChangedEmail({
          ...input,
          kind: "admin_change",
          scheduled: later,
          subscriptionUrl: appUrl("/subscription"),
        }),
      });
    },
    audit: auditSink(db),
  };
}

/** The subscription an admin is changing, checked to belong to the organisation. */
export async function loadAdminSubscriptionContext(
  orgId: string,
  subscriptionId: string,
): Promise<AdminSubscriptionContext | null> {
  const db = createServiceClient();
  const [{ data: sub, error }, { data: seats }] = await Promise.all([
    db
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("org_id", orgId)
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle<{ stripe_subscription_id: string }>(),
    db.rpc("org_seat_usage", { p_org: orgId }),
  ]);
  if (error) throw new Error(`reading the subscription failed: ${error.message}`);
  if (!sub) return null;
  const row = (seats as Array<{ members: number; pending_invites: number }> | null)?.[0];
  return {
    orgId,
    subscriptionId,
    seatsUsed: (row?.members ?? 0) + (row?.pending_invites ?? 0),
  };
}

/** Prices an admin can choose: every active recurring price for the product. */
export async function priceChoices(product: "bank_checker" | "eiscd"): Promise<AdminPrice[]> {
  const stripe = requireStripe();
  const prices: AdminPrice[] = [];
  for await (const price of stripe.prices.list({ active: true, type: "recurring", limit: 100 })) {
    const p = toAdminPrice(price);
    if (p.product === product) prices.push(p);
  }
  return prices.sort(
    (a, b) => a.name.localeCompare(b.name) || (a.unitAmount ?? 0) - (b.unitAmount ?? 0),
  );
}
