// Admin subscription changes (plan §6.8, §6.12, PLAN-09, PLAN-11). The
// admin version of Change plan: any price, including custom and legacy
// ones; keep, end or extend the trial; choose how to prorate; and apply now
// or at renewal. Plus extra seats, trial extensions and cancellations.
// Every change is written to Stripe; the sync that follows (and the
// webhook) updates the database and the key. Every change, and every
// failure, is audited.

import type { PlanChangeRecords } from "@/lib/billing/plan-change";
import type { LiveSubscription } from "@/lib/billing/plan-change";
import { isLiveStatus, type Product } from "@/lib/billing/subscription-record";

import { type AuditSink, errorText } from "./audit";

export type Proration = "none" | "create_prorations" | "always_invoice";
export type TrialChoice = "keep" | "end" | "extend";

export type AdminChangeRequest = {
  priceId: string;
  trial: TrialChoice;
  /** With trial "extend": the new trial end. */
  trialEnd: Date | null;
  proration: Proration;
  when: "now" | "renewal";
};

export type AdminPrice = {
  id: string;
  name: string;
  active: boolean;
  unitAmount: number | null;
  currency: string;
  recurring: { interval: "day" | "week" | "month" | "year"; count: number } | null;
  product: Product;
  maxTeamSize: number | null;
};

/** The trial end to send Stripe: unchanged, now, or a date. */
export type TrialEndChange = null | "now" | Date;

export type AdminSubscriptionStripe = {
  getSubscription(id: string): Promise<LiveSubscription & { product: Product; extraUsers: number }>;
  getPrice(id: string): Promise<AdminPrice | null>;
  preview(input: {
    sub: LiveSubscription;
    priceId: string;
    trialEnd: TrialEndChange;
    proration: Proration;
    prorationDate: number;
  }): Promise<{ amountDue: number; currency: string }>;
  updateNow(input: {
    sub: LiveSubscription;
    priceId: string;
    trialEnd: TrialEndChange;
    proration: Proration;
    prorationDate: number;
    idempotencyKey: string;
  }): Promise<{ amountCharged: number | null }>;
  scheduleAtRenewal(input: {
    sub: LiveSubscription;
    price: AdminPrice;
    idempotencyKey: string;
  }): Promise<{ scheduleId: string }>;
  releaseSchedule(scheduleId: string): Promise<void>;
  setExtraUsers(subscriptionId: string, extraUsers: number, idempotencyKey: string): Promise<void>;
  setTrialEnd(subscriptionId: string, trialEnd: Date, idempotencyKey: string): Promise<void>;
  cancel(subscriptionId: string, when: "now" | "period_end", idempotencyKey: string): Promise<void>;
  undoCancel(subscriptionId: string): Promise<void>;
};

export type AdminSubscriptionDeps = {
  stripe: AdminSubscriptionStripe;
  records: PlanChangeRecords;
  syncSubscription(subscriptionId: string): Promise<void>;
  /** PLAN-10: the owner is told about every plan change. */
  notifyOwner(input: {
    orgId: string;
    planName: string;
    effectiveAt: Date;
    amountDueNow: number | null;
    currency: string | null;
  }): Promise<void>;
  audit: AuditSink;
  now?: () => Date;
};

export type AdminSubscriptionContext = {
  orgId: string;
  subscriptionId: string;
  /** Members plus open invites (TEAM-03). */
  seatsUsed: number;
};

export type AdminResult =
  { ok: true; message: string; warnings: string[] } | { ok: false; error: string };

const DAY_MS = 24 * 60 * 60 * 1000;
/** Stripe refuses trial ends more than two years ahead. */
const MAX_TRIAL_DAYS = 730;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Whether an admin change makes sense, and what to warn about (PLAN-09). */
export function checkAdminChange(
  sub: LiveSubscription & { product: Product; extraUsers: number },
  price: AdminPrice | null,
  request: AdminChangeRequest,
  team: { seatsUsed: number },
  now: Date,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isLiveStatus(sub.status))
    errors.push("The subscription isn't live, so it can't be changed.");
  if (!price) {
    errors.push("Stripe has no such price.");
    return { errors, warnings };
  }
  if (!price.recurring) errors.push("That price isn't recurring.");
  if (price.product !== sub.product) {
    errors.push("That price is for a different product.");
  }
  if (!price.active) warnings.push("That price is inactive (a legacy price).");

  if (request.when === "renewal") {
    if (request.trial !== "keep") errors.push("A change at renewal can't also change the trial.");
    if (sub.trialing)
      errors.push("During a trial, change the plan now instead; it takes effect with no charge.");
  }
  if (request.trial === "end" && !sub.trialing) errors.push("The subscription isn't on a trial.");
  if (request.trial === "extend") {
    if (!sub.trialing) errors.push("Only a trial can be extended.");
    if (!request.trialEnd || request.trialEnd.getTime() <= now.getTime()) {
      errors.push("Choose a new trial end in the future.");
    } else if (request.trialEnd.getTime() > now.getTime() + MAX_TRIAL_DAYS * DAY_MS) {
      errors.push("A trial can't run more than two years from today.");
    }
  }
  if (price.id === sub.priceId && request.trial === "keep") {
    errors.push("That's the current price, so there's nothing to change.");
  }

  if (price.maxTeamSize !== null) {
    const limit = price.maxTeamSize + sub.extraUsers;
    if (team.seatsUsed > limit) {
      warnings.push(
        `That price allows ${plural(limit, "seat", "seats")} (with extra seats) and the team uses ${team.seatsUsed}. Nobody is removed, but the owner can't invite anyone.`,
      );
    }
  } else if (price.product === "bank_checker") {
    warnings.push("That price has no maxTeamSize, so the seat limit will be unknown.");
  }
  return { errors, warnings };
}

const trialEndFor = (request: AdminChangeRequest): TrialEndChange =>
  request.trial === "end" ? "now" : request.trial === "extend" ? request.trialEnd : null;

export type AdminQuote = {
  planName: string;
  /** Charged straight away, tax included, in pence; null when applied at renewal. */
  today: number | null;
  currency: string;
  effectiveAt: Date;
  prorationDate: number;
  warnings: string[];
};

export async function quoteAdminChange(
  deps: AdminSubscriptionDeps,
  ctx: AdminSubscriptionContext,
  request: AdminChangeRequest,
): Promise<{ ok: true; quote: AdminQuote } | { ok: false; error: string }> {
  const now = deps.now?.() ?? new Date();
  const [sub, price] = await Promise.all([
    deps.stripe.getSubscription(ctx.subscriptionId),
    deps.stripe.getPrice(request.priceId),
  ]);
  const check = checkAdminChange(sub, price, request, ctx, now);
  if (check.errors.length || !price) return { ok: false, error: check.errors.join(" ") };

  const prorationDate = Math.floor(now.getTime() / 1000);
  if (request.when === "renewal") {
    return {
      ok: true,
      quote: {
        planName: price.name,
        today: null,
        currency: price.currency,
        effectiveAt: sub.currentPeriodEnd,
        prorationDate,
        warnings: check.warnings,
      },
    };
  }
  const preview = await deps.stripe.preview({
    sub,
    priceId: price.id,
    trialEnd: trialEndFor(request),
    proration: request.proration,
    prorationDate,
  });
  return {
    ok: true,
    quote: {
      planName: price.name,
      today: preview.amountDue,
      currency: preview.currency,
      effectiveAt: now,
      prorationDate,
      warnings: check.warnings,
    },
  };
}

export async function applyAdminChange(
  deps: AdminSubscriptionDeps,
  ctx: AdminSubscriptionContext,
  request: AdminChangeRequest,
  input: { actorId: string; prorationDate: number; nonce: string },
): Promise<AdminResult> {
  const now = deps.now?.() ?? new Date();
  const age = now.getTime() / 1000 - input.prorationDate;
  if (!(age >= 0 && age <= 30 * 60)) {
    return { ok: false, error: "That preview has expired. Preview the change again." };
  }
  const [sub, price] = await Promise.all([
    deps.stripe.getSubscription(ctx.subscriptionId),
    deps.stripe.getPrice(request.priceId),
  ]);
  const check = checkAdminChange(sub, price, request, ctx, now);
  if (check.errors.length || !price) return { ok: false, error: check.errors.join(" ") };

  const details = {
    stripe_subscription_id: ctx.subscriptionId,
    trial: request.trial,
    trial_end: request.trialEnd?.toISOString() ?? null,
    proration: request.proration,
    when: request.when,
  };
  const before = { price_id: sub.priceId, trial_end: sub.trialEnd?.toISOString() ?? null };
  const base = {
    orgId: ctx.orgId,
    actorId: input.actorId,
    actorKind: "admin" as const,
    subscriptionId: ctx.subscriptionId,
    fromPriceId: sub.priceId,
    toPriceId: price.id,
    kind: "admin_change" as const,
  };
  const effectiveAt = request.when === "renewal" ? sub.currentPeriodEnd : now;

  let scheduleId: string | null = null;
  let amountCharged: number | null = null;
  try {
    // One pending scheduled change at a time: this one replaces it.
    const pending = await deps.records.scheduled(ctx.orgId);
    const pendingSchedule = pending?.scheduleId ?? sub.scheduleId;
    if (pendingSchedule) await deps.stripe.releaseSchedule(pendingSchedule);
    if (pending) await deps.records.cancelScheduled(ctx.orgId);
    const liveSub = pendingSchedule ? { ...sub, scheduleId: null } : sub;

    const idempotencyKey = `admin-change-${ctx.subscriptionId}-${input.nonce}`;
    if (request.when === "renewal") {
      ({ scheduleId } = await deps.stripe.scheduleAtRenewal({
        sub: liveSub,
        price,
        idempotencyKey,
      }));
    } else {
      ({ amountCharged } = await deps.stripe.updateNow({
        sub: liveSub,
        priceId: price.id,
        trialEnd: trialEndFor(request),
        proration: request.proration,
        prorationDate: input.prorationDate,
        idempotencyKey,
      }));
    }
  } catch (error) {
    await deps.records
      .record({
        ...base,
        effectiveAt,
        scheduleId: null,
        amountDueNow: null,
        currency: null,
        status: "failed",
        error: errorText(error).slice(0, 1000),
      })
      .catch((e) => console.error("recording the failed plan change failed", e));
    await deps.audit({
      actorId: input.actorId,
      orgId: ctx.orgId,
      action: "subscription.failed",
      before,
      details: {
        ...details,
        change: "change_plan",
        to_price_id: price.id,
        error: errorText(error),
      },
    });
    return {
      ok: false,
      error: `Stripe refused the change, so nothing changed: ${errorText(error)}`,
    };
  }

  await deps.records.record({
    ...base,
    effectiveAt,
    scheduleId,
    amountDueNow: amountCharged,
    currency: price.currency,
    status: request.when === "renewal" ? "scheduled" : "done",
  });
  await deps.audit({
    actorId: input.actorId,
    orgId: ctx.orgId,
    action: "subscription.change_plan",
    before,
    after: {
      price_id: price.id,
      trial_end:
        request.trial === "extend"
          ? (request.trialEnd?.toISOString() ?? null)
          : request.trial === "end"
            ? now.toISOString()
            : before.trial_end,
    },
    details: { ...details, amount_charged: amountCharged, schedule_id: scheduleId },
  });

  const warnings = [...check.warnings];
  if (request.when === "now") await syncAfter(deps, ctx.subscriptionId, warnings);
  try {
    await deps.notifyOwner({
      orgId: ctx.orgId,
      planName: price.name,
      effectiveAt,
      amountDueNow: amountCharged,
      currency: price.currency,
    });
  } catch (error) {
    console.error("plan change email failed", error);
    warnings.push("The owner's confirmation email couldn't be sent.");
  }
  return {
    ok: true,
    message:
      request.when === "renewal"
        ? `The plan changes to ${price.name} at renewal.`
        : `The plan is now ${price.name}.`,
    warnings,
  };
}

async function syncAfter(deps: AdminSubscriptionDeps, subscriptionId: string, warnings: string[]) {
  try {
    await deps.syncSubscription(subscriptionId);
  } catch (error) {
    console.error("syncing after an admin change failed", error);
    warnings.push(
      "Stripe has the change, but the database and key weren't updated yet. The webhook will catch up, or resync.",
    );
  }
}

/**
 * Runs one Stripe write, then syncs and audits it; a failure is audited as
 * subscription.failed and nothing else happens.
 */
async function simpleChange(
  deps: AdminSubscriptionDeps,
  ctx: AdminSubscriptionContext,
  input: {
    actorId: string;
    action: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    write: () => Promise<void>;
    message: string;
  },
): Promise<AdminResult> {
  try {
    await input.write();
  } catch (error) {
    await deps.audit({
      actorId: input.actorId,
      orgId: ctx.orgId,
      action: "subscription.failed",
      before: input.before,
      details: {
        stripe_subscription_id: ctx.subscriptionId,
        change: input.action,
        wanted: input.after,
        error: errorText(error),
      },
    });
    return {
      ok: false,
      error: `Stripe refused the change, so nothing changed: ${errorText(error)}`,
    };
  }
  await deps.audit({
    actorId: input.actorId,
    orgId: ctx.orgId,
    action: input.action,
    before: input.before,
    after: input.after,
    details: { stripe_subscription_id: ctx.subscriptionId },
  });
  const warnings: string[] = [];
  await syncAfter(deps, ctx.subscriptionId, warnings);
  return { ok: true, message: input.message, warnings };
}

/** Extra seats on top of the plan's (PLAN-11): only admins set them. */
export async function setExtraSeats(
  deps: AdminSubscriptionDeps,
  ctx: AdminSubscriptionContext,
  input: { actorId: string; extraUsers: number; nonce: string },
): Promise<AdminResult> {
  if (!Number.isInteger(input.extraUsers) || input.extraUsers < 0 || input.extraUsers > 1000) {
    return { ok: false, error: "Extra seats must be a whole number from 0 to 1000." };
  }
  const sub = await deps.stripe.getSubscription(ctx.subscriptionId);
  if (!isLiveStatus(sub.status)) return { ok: false, error: "The subscription isn't live." };
  if (sub.extraUsers === input.extraUsers) {
    return {
      ok: false,
      error: `There are already ${plural(input.extraUsers, "extra seat", "extra seats")}.`,
    };
  }
  return simpleChange(deps, ctx, {
    actorId: input.actorId,
    action: "subscription.extra_seats",
    before: { extra_users: sub.extraUsers },
    after: { extra_users: input.extraUsers },
    write: () =>
      deps.stripe.setExtraUsers(
        ctx.subscriptionId,
        input.extraUsers,
        `admin-seats-${ctx.subscriptionId}-${input.nonce}`,
      ),
    message: `Extra seats set to ${input.extraUsers}.`,
  });
}

/** Moves a trial's end later, with no charge (plan §6.8). */
export async function extendTrial(
  deps: AdminSubscriptionDeps,
  ctx: AdminSubscriptionContext,
  input: { actorId: string; trialEnd: Date; nonce: string },
): Promise<AdminResult> {
  const now = deps.now?.() ?? new Date();
  const sub = await deps.stripe.getSubscription(ctx.subscriptionId);
  if (!sub.trialing) return { ok: false, error: "The subscription isn't on a trial." };
  if (sub.trialEnd && input.trialEnd.getTime() <= sub.trialEnd.getTime()) {
    return { ok: false, error: "Choose a date after the current trial end." };
  }
  if (input.trialEnd.getTime() > now.getTime() + MAX_TRIAL_DAYS * DAY_MS) {
    return { ok: false, error: "A trial can't run more than two years from today." };
  }
  return simpleChange(deps, ctx, {
    actorId: input.actorId,
    action: "subscription.extend_trial",
    before: { trial_end: sub.trialEnd?.toISOString() ?? null },
    after: { trial_end: input.trialEnd.toISOString() },
    write: () =>
      deps.stripe.setTrialEnd(
        ctx.subscriptionId,
        input.trialEnd,
        `admin-trial-${ctx.subscriptionId}-${input.nonce}`,
      ),
    message: "The trial is extended.",
  });
}

/** Cancel now (the key goes off at once) or at the end of the period. */
export async function cancelSubscription(
  deps: AdminSubscriptionDeps,
  ctx: AdminSubscriptionContext,
  input: { actorId: string; when: "now" | "period_end"; nonce: string },
): Promise<AdminResult> {
  const sub = await deps.stripe.getSubscription(ctx.subscriptionId);
  if (!isLiveStatus(sub.status)) return { ok: false, error: "The subscription has already ended." };
  if (input.when === "period_end" && sub.cancelAt) {
    return { ok: false, error: "The subscription is already due to end." };
  }
  return simpleChange(deps, ctx, {
    actorId: input.actorId,
    action: "subscription.cancel",
    before: { status: sub.status, cancel_at: sub.cancelAt?.toISOString() ?? null },
    after: { when: input.when },
    write: () =>
      deps.stripe.cancel(
        ctx.subscriptionId,
        input.when,
        `admin-cancel-${ctx.subscriptionId}-${input.nonce}`,
      ),
    message:
      input.when === "now"
        ? "The subscription is cancelled and the key is off."
        : "The subscription will end at the end of the period.",
  });
}

/** Takes back a cancellation at the end of the period. */
export async function undoCancellation(
  deps: AdminSubscriptionDeps,
  ctx: AdminSubscriptionContext,
  input: { actorId: string },
): Promise<AdminResult> {
  const sub = await deps.stripe.getSubscription(ctx.subscriptionId);
  if (!isLiveStatus(sub.status) || !sub.cancelAt) {
    return { ok: false, error: "The subscription isn't due to end." };
  }
  return simpleChange(deps, ctx, {
    actorId: input.actorId,
    action: "subscription.undo_cancel",
    before: { cancel_at: sub.cancelAt.toISOString() },
    after: { cancel_at: null },
    write: () => deps.stripe.undoCancel(ctx.subscriptionId),
    message: "The subscription will carry on.",
  });
}
