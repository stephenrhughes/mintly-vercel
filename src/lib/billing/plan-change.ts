// Changing plan (plan §6.12): one service for owners now and admins later
// (PLAN-09). It classifies the request, quotes it from Stripe's own
// preview (PLAN-05), applies it to the existing subscription, never a
// second checkout (PLAN-01), records it (PLAN-10) and confirms it by email.
// The API key follows the subscription: the webhook (and the sync below)
// moves it to the new usage plan, and it never changes.

import {
  type ChangeKind,
  type ChangeRequest,
  type Classification,
  classifyChange,
  type CurrentPlan,
} from "./change-plan";
import { type BillingInterval, PLANS, type PlanTier } from "./plans";

/** The subscription as Stripe has it now. */
export type LiveSubscription = {
  id: string;
  customerId: string;
  itemId: string;
  priceId: string;
  status: string;
  trialing: boolean;
  trialEnd: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  scheduleId: string | null;
  hasPaymentMethod: boolean;
  cancelAt: Date | null;
  /** From the live price's metadata. */
  tier: PlanTier | null;
  interval: BillingInterval | null;
  custom: boolean;
};

/**
 * The current plan as Stripe has it. The database can lag Stripe by a
 * webhook, so the rules always run against the live subscription.
 */
export function liveCurrentPlan(current: CurrentPlan, sub: LiveSubscription): CurrentPlan {
  return {
    ...current,
    status: sub.status,
    trialing: sub.trialing,
    cancelAt: sub.cancelAt,
    priceId: sub.priceId,
    tier: sub.tier,
    interval: sub.interval,
    custom: sub.custom,
  };
}

export type TargetPrice = {
  id: string;
  unitAmount: number;
  currency: string;
  interval: BillingInterval;
};

export type PlanChangeStripe = {
  getSubscription(id: string): Promise<LiveSubscription>;
  /** What Stripe would charge straight away, tax included. */
  previewAmountDue(input: {
    sub: LiveSubscription;
    priceId: string;
    kind: "start_paid" | "upgrade";
    prorationDate: number;
  }): Promise<{ amountDue: number; currency: string }>;
  apply(input: {
    sub: LiveSubscription;
    priceId: string;
    interval: BillingInterval;
    kind: ChangeKind;
    prorationDate: number;
    idempotencyKey: string;
  }): Promise<{ scheduleId: string | null; amountCharged: number | null }>;
  releaseSchedule(scheduleId: string): Promise<void>;
};

export type ScheduledChange = {
  id: string;
  toPriceId: string;
  effectiveAt: Date;
  scheduleId: string | null;
};

export type PlanChangeRecord = {
  orgId: string;
  actorId: string | null;
  actorKind: "owner" | "admin";
  subscriptionId: string;
  fromPriceId: string;
  toPriceId: string;
  kind: ChangeKind;
  effectiveAt: Date;
  scheduleId: string | null;
  amountDueNow: number | null;
  currency: string | null;
  status: "done" | "scheduled" | "failed";
  error?: string;
};

export type PlanChangeRecords = {
  scheduled(orgId: string): Promise<ScheduledChange | null>;
  cancelScheduled(orgId: string): Promise<void>;
  record(change: PlanChangeRecord): Promise<void>;
};

export type PlanChangeDeps = {
  stripe: PlanChangeStripe;
  records: PlanChangeRecords;
  findPrice(tier: PlanTier, interval: BillingInterval): Promise<TargetPrice | null>;
  /** Re-syncs the subscription so the database and key follow at once. */
  syncSubscription(subscriptionId: string): Promise<void>;
  notifyChanged(input: {
    orgId: string;
    planName: string;
    kind: ChangeKind;
    effectiveAt: Date;
    amountDueNow: number | null;
    currency: string | null;
  }): Promise<void>;
  now?: () => Date;
};

export type ChangeContext = {
  orgId: string;
  subscriptionId: string;
  current: CurrentPlan;
  team: { seatsUsed: number; extraUsers: number };
  monthlyChecks: number | null;
};

export type Quote = {
  kind: ChangeKind;
  planName: string;
  /** Charged today, tax included, in pence. */
  today: number;
  currency: string;
  /** The regular charge afterwards, before VAT. */
  then: { amount: number; interval: BillingInterval; from: Date };
  /** The time the quote was made, which an upgrade's proration uses again when applied. */
  prorationDate: number;
  warnings: string[];
};

export type QuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; classification: Classification & { allowed: false } }
  | { ok: false; error: string };

const addInterval = (date: Date, interval: BillingInterval) => {
  const next = new Date(date);
  if (interval === "annual") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
};

/** Classifies and prices a change, without making it (PLAN-05). */
export async function quoteChange(
  deps: PlanChangeDeps,
  ctx: ChangeContext,
  request: ChangeRequest,
): Promise<QuoteResult> {
  const sub = await deps.stripe.getSubscription(ctx.subscriptionId);
  const current = liveCurrentPlan(ctx.current, sub);
  const classification = classifyChange(current, request, ctx.team, {
    monthlyChecks: ctx.monthlyChecks,
  });
  if (!classification.allowed) return { ok: false, classification };

  const price = await deps.findPrice(request.tier, request.interval);
  if (!price)
    return {
      ok: false,
      error: `${PLANS[request.tier].name} isn't available ${request.interval} right now.`,
    };

  const now = deps.now?.() ?? new Date();
  const prorationDate = Math.floor(now.getTime() / 1000);

  let today = 0;
  let currency = price.currency;
  let from: Date;
  switch (classification.kind) {
    case "trial_switch":
      from = sub.trialEnd ?? sub.currentPeriodEnd;
      break;
    case "downgrade_scheduled":
      from = sub.currentPeriodEnd;
      break;
    case "start_paid":
    case "upgrade": {
      const preview = await deps.stripe.previewAmountDue({
        sub,
        priceId: price.id,
        kind: classification.kind,
        prorationDate,
      });
      today = preview.amountDue;
      currency = preview.currency;
      // A new billing period starts now unless only the tier changes.
      const intervalChanged = current.interval !== request.interval;
      from =
        classification.kind === "start_paid" || intervalChanged
          ? addInterval(now, request.interval)
          : sub.currentPeriodEnd;
      break;
    }
  }

  return {
    ok: true,
    quote: {
      kind: classification.kind,
      planName: PLANS[request.tier].name,
      today,
      currency,
      then: { amount: price.unitAmount, interval: request.interval, from },
      prorationDate,
      warnings: classification.warnings,
    },
  };
}

export type ApplyResult =
  | { ok: true; kind: ChangeKind; message: string }
  | { ok: false; error: string }
  | { ok: false; needsCard: true };

/**
 * Makes the change. `nonce` comes from the quote the owner confirmed, so a
 * double click sends Stripe the same idempotency key and changes nothing
 * twice (plan §6.12 rules).
 */
export async function applyChange(
  deps: PlanChangeDeps,
  ctx: ChangeContext,
  request: ChangeRequest,
  input: {
    actorId: string | null;
    actorKind: "owner" | "admin";
    prorationDate: number;
    nonce: string;
  },
): Promise<ApplyResult> {
  const now = deps.now?.() ?? new Date();
  // A quote is honoured for 30 minutes; after that, quote again.
  const age = now.getTime() / 1000 - input.prorationDate;
  if (!(age >= 0 && age <= 30 * 60))
    return { ok: false, error: "That quote has expired. Check the new amounts and confirm again." };

  const sub = await deps.stripe.getSubscription(ctx.subscriptionId);
  const classification = classifyChange(liveCurrentPlan(ctx.current, sub), request, ctx.team, {
    monthlyChecks: ctx.monthlyChecks,
  });
  if (!classification.allowed) return { ok: false, error: classification.message };
  const kind = classification.kind;

  const price = await deps.findPrice(request.tier, request.interval);
  if (!price) return { ok: false, error: `${PLANS[request.tier].name} isn't available right now.` };

  if (kind === "start_paid" && !sub.hasPaymentMethod) return { ok: false, needsCard: true };

  // One pending scheduled change at a time: any new change replaces it.
  const pending = await deps.records.scheduled(ctx.orgId);
  const scheduleId = pending?.scheduleId ?? sub.scheduleId;
  if (scheduleId) await deps.stripe.releaseSchedule(scheduleId);
  if (pending) await deps.records.cancelScheduled(ctx.orgId);
  const liveSub = scheduleId ? { ...sub, scheduleId: null } : sub;

  const base = {
    orgId: ctx.orgId,
    actorId: input.actorId,
    actorKind: input.actorKind,
    subscriptionId: ctx.subscriptionId,
    fromPriceId: sub.priceId,
    toPriceId: price.id,
    kind,
  };
  const effectiveAt = kind === "downgrade_scheduled" ? sub.currentPeriodEnd : now;

  let applied: { scheduleId: string | null; amountCharged: number | null };
  try {
    applied = await deps.stripe.apply({
      sub: liveSub,
      priceId: price.id,
      interval: price.interval,
      kind,
      prorationDate: input.prorationDate,
      idempotencyKey: `plan-change-${ctx.subscriptionId}-${input.nonce}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.records.record({
      ...base,
      effectiveAt,
      scheduleId: null,
      amountDueNow: null,
      currency: null,
      status: "failed",
      error: message.slice(0, 1000),
    });
    return {
      ok: false,
      error:
        kind === "upgrade" || kind === "start_paid"
          ? "Your payment didn't go through, so your plan hasn't changed. Check your card in billing and try again."
          : "Stripe couldn't make the change, so your plan hasn't changed. Please try again.",
    };
  }

  await deps.records.record({
    ...base,
    effectiveAt,
    scheduleId: applied.scheduleId,
    amountDueNow: applied.amountCharged,
    currency: price.currency,
    status: kind === "downgrade_scheduled" ? "scheduled" : "done",
  });

  // The webhook does this too; doing it now means the page and the key
  // reflect the change straight away.
  if (kind !== "downgrade_scheduled") {
    try {
      await deps.syncSubscription(ctx.subscriptionId);
    } catch (error) {
      console.error("syncing after a plan change failed; the webhook will catch up", error);
    }
  }

  const planName = PLANS[request.tier].name;
  try {
    await deps.notifyChanged({
      orgId: ctx.orgId,
      planName,
      kind,
      effectiveAt,
      amountDueNow: applied.amountCharged,
      currency: price.currency,
    });
  } catch (error) {
    console.error("plan change confirmation email failed", error);
  }

  const messages: Record<ChangeKind, string> = {
    trial_switch: `You're now trialling the ${planName}.`,
    start_paid: `Your ${planName} has started. Thank you!`,
    upgrade: `You're now on the ${planName}.`,
    downgrade_scheduled: `Your plan will change to the ${planName} at the end of this billing period.`,
  };
  return { ok: true, kind, message: messages[kind] };
}

/** Cancels a scheduled downgrade (PLAN-04): the plan stays as it is. */
export async function cancelScheduledChange(
  deps: PlanChangeDeps,
  ctx: Pick<ChangeContext, "orgId">,
): Promise<{ ok: boolean; message: string }> {
  const pending = await deps.records.scheduled(ctx.orgId);
  if (!pending) return { ok: false, message: "There's no scheduled change to cancel." };
  if (pending.scheduleId) await deps.stripe.releaseSchedule(pending.scheduleId);
  await deps.records.cancelScheduled(ctx.orgId);
  return { ok: true, message: "The scheduled change is cancelled. Your plan stays as it is." };
}
