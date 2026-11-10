import "server-only";

import type Stripe from "stripe";

import { PlanChangedEmail, planChangedSubject } from "@/emails/plan-change";
import { sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/hosts";
import { getPlanPrice, getPrice } from "@/lib/stripe/catalogue";
import { requireStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/admin";

import type { CurrentPlan } from "./change-plan";
import { isBillingInterval, isPlanTier } from "./plans";
import type {
  ChangeContext,
  LiveSubscription,
  PlanChangeDeps,
  PlanChangeRecords,
  PlanChangeStripe,
} from "./plan-change";
import { syncSubscription } from "./provision";
import { provisionDeps } from "./server";
import { priceMeta, subscriptionItem } from "./subscription-record";
import type { ReviewStatus } from "@/lib/nav";
import { projectedMonthlyChecks } from "@/lib/usage/queries";

// Wires the plan-change service (plan-change.ts) to Stripe, Supabase and email.

const toDate = (seconds: number) => new Date(seconds * 1000);
const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

/** The subscription as the plan-change rules see it. Expand `customer` to see its card. */
export function liveSubscriptionFrom(sub: Stripe.Subscription): LiveSubscription {
  const item = subscriptionItem(sub);
  if (!item) throw new Error(`Subscription ${sub.id} has no items`);
  const meta = priceMeta(item.price);
  const customer =
    typeof sub.customer === "object" && !("deleted" in sub.customer && sub.customer.deleted)
      ? (sub.customer as Stripe.Customer)
      : null;
  return {
    id: sub.id,
    customerId: idOf(sub.customer as string | { id: string }) ?? "",
    itemId: item.id,
    priceId: item.price.id,
    status: sub.status,
    trialing: sub.status === "trialing",
    trialEnd: sub.trial_end ? toDate(sub.trial_end) : null,
    currentPeriodStart: toDate(sub.items.data[0].current_period_start),
    currentPeriodEnd: toDate(sub.items.data[0].current_period_end),
    scheduleId: idOf(sub.schedule as string | { id: string } | null),
    cancelAt: sub.cancel_at ? toDate(sub.cancel_at) : null,
    tier: isPlanTier(meta.tier) ? meta.tier : null,
    interval: isBillingInterval(meta.interval) ? meta.interval : null,
    custom: meta.custom,
    hasPaymentMethod: Boolean(
      sub.default_payment_method ||
      sub.default_source ||
      customer?.invoice_settings?.default_payment_method ||
      customer?.default_source,
    ),
  };
}

export function stripePlanChanges(stripe: Stripe): PlanChangeStripe {
  return {
    async getSubscription(id): Promise<LiveSubscription> {
      return liveSubscriptionFrom(
        await stripe.subscriptions.retrieve(id, { expand: ["customer"] }),
      );
    },

    async previewAmountDue({ sub, priceId, kind, prorationDate }) {
      // Stripe's own preview, so the page and the invoice agree (PLAN-05).
      // With always_invoice it is the invoice an upgrade creates at once;
      // with trial_end now, the first invoice of the paid plan.
      const preview = await stripe.invoices.createPreview({
        customer: sub.customerId,
        subscription: sub.id,
        subscription_details: {
          items: [{ id: sub.itemId, price: priceId }],
          ...(kind === "upgrade"
            ? { proration_behavior: "always_invoice", proration_date: prorationDate }
            : { proration_behavior: "none", trial_end: "now" }),
        },
      });
      return { amountDue: preview.amount_due, currency: preview.currency };
    },

    async apply({ sub, priceId, interval, kind, prorationDate, idempotencyKey }) {
      const items = [{ id: sub.itemId, price: priceId }];
      switch (kind) {
        case "trial_switch":
          // PLAN-02: same trial end, no charge.
          await stripe.subscriptions.update(
            sub.id,
            { items, proration_behavior: "none" },
            { idempotencyKey },
          );
          return { scheduleId: null, amountCharged: null };
        case "start_paid":
        case "upgrade": {
          // PLAN-03, PLAN-04. error_if_incomplete: if the payment fails,
          // Stripe makes no change at all.
          const updated = await stripe.subscriptions.update(
            sub.id,
            {
              items,
              payment_behavior: "error_if_incomplete",
              expand: ["latest_invoice"],
              ...(kind === "start_paid"
                ? { trial_end: "now", proration_behavior: "none" }
                : { proration_behavior: "always_invoice", proration_date: prorationDate }),
            },
            { idempotencyKey },
          );
          const invoice = updated.latest_invoice as Stripe.Invoice | null;
          return {
            scheduleId: null,
            amountCharged: invoice?.amount_paid ?? invoice?.amount_due ?? null,
          };
        }
        case "downgrade_scheduled": {
          // PLAN-04: the rest of this period on the current price, then the
          // new one, through a subscription schedule that releases after.
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
                  items: [{ price: priceId }],
                  duration: {
                    interval: interval === "annual" ? "year" : "month",
                    interval_count: 1,
                  },
                },
              ],
            },
            { idempotencyKey: `${idempotencyKey}-update` },
          );
          return { scheduleId: schedule.id, amountCharged: null };
        }
      }
    },

    async releaseSchedule(scheduleId) {
      try {
        await stripe.subscriptionSchedules.release(scheduleId);
      } catch (error) {
        // Already released or completed: nothing left to undo.
        if (
          (error as { code?: string }).code !== "resource_missing" &&
          !String(error).includes("released")
        )
          throw error;
      }
    },
  };
}

export function supabasePlanChangeRecords(): PlanChangeRecords {
  const db = createServiceClient();
  return {
    async scheduled(orgId) {
      const { data, error } = await db
        .from("plan_changes")
        .select("id, to_price_id, effective_at, stripe_schedule_id")
        .eq("org_id", orgId)
        .eq("status", "scheduled")
        .maybeSingle<{
          id: string;
          to_price_id: string;
          effective_at: string;
          stripe_schedule_id: string | null;
        }>();
      if (error) throw new Error(`reading the scheduled change failed: ${error.message}`);
      return data
        ? {
            id: data.id,
            toPriceId: data.to_price_id,
            effectiveAt: new Date(data.effective_at),
            scheduleId: data.stripe_schedule_id,
          }
        : null;
    },
    async cancelScheduled(orgId) {
      const { error } = await db
        .from("plan_changes")
        .update({ status: "cancelled" })
        .eq("org_id", orgId)
        .eq("status", "scheduled");
      if (error) throw new Error(`cancelling the scheduled change failed: ${error.message}`);
    },
    async record(change) {
      const { error } = await db.from("plan_changes").insert({
        org_id: change.orgId,
        actor_id: change.actorId,
        actor_kind: change.actorKind,
        stripe_subscription_id: change.subscriptionId,
        from_price_id: change.fromPriceId,
        to_price_id: change.toPriceId,
        kind: change.kind,
        effective_at: change.effectiveAt.toISOString(),
        stripe_schedule_id: change.scheduleId,
        amount_due_now: change.amountDueNow,
        currency: change.currency,
        status: change.status,
        error: change.error ?? null,
      });
      if (error) throw new Error(`recording the plan change failed: ${error.message}`);
    },
  };
}

export async function ownerEmail(orgId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data: owner } = await db
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .maybeSingle<{ user_id: string }>();
  if (!owner) return null;
  const { data } = await db
    .from("profiles")
    .select("email")
    .eq("id", owner.user_id)
    .maybeSingle<{ email: string }>();
  return data?.email ?? null;
}

export function planChangeDeps(): PlanChangeDeps {
  return {
    stripe: stripePlanChanges(requireStripe()),
    records: supabasePlanChangeRecords(),
    async findPrice(tier, interval) {
      const price = await getPlanPrice(tier, interval);
      if (!price || price.unit_amount === null) return null;
      return { id: price.id, unitAmount: price.unit_amount, currency: price.currency, interval };
    },
    async syncSubscription(subscriptionId) {
      await syncSubscription(provisionDeps(), subscriptionId, null);
    },
    async notifyChanged(input) {
      const to = await ownerEmail(input.orgId);
      if (!to) return;
      await sendEmail({
        to,
        subject: planChangedSubject(input.kind, input.planName),
        react: PlanChangedEmail({ ...input, subscriptionUrl: appUrl("/subscription") }),
      });
    },
  };
}

/**
 * Everything the change rules need about an organisation's live Bank
 * Account Checker subscription, or null if it has none.
 */
export async function loadChangeContext(orgId: string): Promise<ChangeContext | null> {
  const db = createServiceClient();
  const [{ data: sub, error }, { data: org }, { data: seats }] = await Promise.all([
    db
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_price_id, status, trialing, cancel_at, extra_users")
      .eq("org_id", orgId)
      .eq("product", "bank_checker")
      .eq("expired", false)
      .maybeSingle<{
        stripe_subscription_id: string;
        stripe_price_id: string;
        status: string;
        trialing: boolean;
        cancel_at: string | null;
        extra_users: number;
      }>(),
    db
      .from("organisations")
      .select("review_status")
      .eq("id", orgId)
      .single<{ review_status: ReviewStatus }>(),
    // Seats used: members plus open invites (TEAM-03, PLAN-05).
    db.rpc("org_seat_usage", { p_org: orgId }),
  ]);
  if (error) throw new Error(`reading the subscription failed: ${error.message}`);
  if (!sub || !org) return null;

  const meta = priceMeta(await getPrice(sub.stripe_price_id));
  const current: CurrentPlan = {
    status: sub.status,
    trialing: sub.trialing,
    cancelAt: sub.cancel_at ? new Date(sub.cancel_at) : null,
    priceId: sub.stripe_price_id,
    tier: isPlanTier(meta.tier) ? meta.tier : null,
    interval: isBillingInterval(meta.interval) ? meta.interval : null,
    custom: meta.custom,
    reviewStatus: org.review_status,
  };
  return {
    orgId,
    subscriptionId: sub.stripe_subscription_id,
    current,
    team: {
      seatsUsed: seatsUsed(seats),
      extraUsers: sub.extra_users,
    },
    // PLAN-06, PLAN-07: the recent rate from the nightly usage sync.
    monthlyChecks: await projectedMonthlyChecks(orgId).catch((error: unknown) => {
      console.error("reading usage for the plan change failed", error);
      return null;
    }),
  };
}

/**
 * PLAN-03: an owner with no card adds one through Stripe Checkout in setup
 * mode, then comes back to confirm the paid plan.
 */
export async function cardSetupUrl(input: {
  orgId: string;
  tier: string;
  interval: string;
}): Promise<string> {
  const db = createServiceClient();
  const { data: org, error } = await db
    .from("organisations")
    .select("stripe_customer_id")
    .eq("id", input.orgId)
    .single<{ stripe_customer_id: string | null }>();
  if (error || !org?.stripe_customer_id) throw new Error("The organisation has no Stripe customer");
  const back = `tier=${encodeURIComponent(input.tier)}&interval=${encodeURIComponent(input.interval)}`;
  const session = await requireStripe().checkout.sessions.create({
    mode: "setup",
    customer: org.stripe_customer_id,
    currency: "gbp",
    metadata: { org_id: input.orgId, purpose: "start_paid" },
    success_url: appUrl(`/subscription/change/card-added?session_id={CHECKOUT_SESSION_ID}&${back}`),
    cancel_url: appUrl(`/subscription/change?${back}&mode=start_paid`),
  });
  if (!session.url) throw new Error("Stripe returned no Checkout URL");
  return session.url;
}

/**
 * After the card is added: make it the default for the customer and the
 * subscription, so the first paid invoice can be charged. Only for the
 * organisation the setup session was made for.
 */
export async function adoptAddedCard(input: {
  orgId: string;
  sessionId: string;
}): Promise<boolean> {
  const stripe = requireStripe();
  const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
    expand: ["setup_intent"],
  });
  if (
    session.mode !== "setup" ||
    session.status !== "complete" ||
    session.metadata?.org_id !== input.orgId
  ) {
    return false;
  }
  const intent = session.setup_intent as Stripe.SetupIntent | null;
  const paymentMethod = idOf(intent?.payment_method as string | { id: string } | null);
  const customer = idOf(session.customer as string | { id: string } | null);
  if (!paymentMethod || !customer) return false;

  const ctx = await loadChangeContext(input.orgId);
  await stripe.customers.update(customer, {
    invoice_settings: { default_payment_method: paymentMethod },
  });
  if (ctx) {
    await stripe.subscriptions.update(ctx.subscriptionId, {
      default_payment_method: paymentMethod,
    });
  }
  return true;
}

/** Members plus open invites, from org_seat_usage (TEAM-03); at least the owner. */
function seatsUsed(rows: unknown): number {
  const row = (rows as { members: number; pending_invites: number }[] | null)?.[0];
  return Math.max(1, (row?.members ?? 1) + (row?.pending_invites ?? 0));
}
