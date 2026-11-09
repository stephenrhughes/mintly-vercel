import { beforeEach, describe, expect, it } from "vitest";

import type { CurrentPlan } from "./change-plan";
import {
  applyChange,
  cancelScheduledChange,
  type ChangeContext,
  type LiveSubscription,
  type PlanChangeDeps,
  type PlanChangeRecord,
  quoteChange,
  type ScheduledChange,
} from "./plan-change";

const NOW = new Date("2026-11-12T10:00:00Z");
const NOW_S = Math.floor(NOW.getTime() / 1000);

function setup(subOverrides: Partial<LiveSubscription> = {}) {
  const sub: LiveSubscription = {
    id: "sub_1",
    customerId: "cus_1",
    itemId: "si_1",
    priceId: "price_plus_m",
    status: "active",
    trialing: false,
    trialEnd: null,
    currentPeriodStart: new Date("2026-11-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
    scheduleId: null,
    hasPaymentMethod: true,
    cancelAt: null,
    tier: "standardPlus",
    interval: "monthly",
    custom: false,
    ...subOverrides,
  };
  const calls: string[] = [];
  const records: PlanChangeRecord[] = [];
  let scheduled: ScheduledChange | null = null;
  const emails: string[] = [];
  let failApply = false;

  const deps: PlanChangeDeps = {
    stripe: {
      async getSubscription() {
        return { ...sub };
      },
      async previewAmountDue({ kind, priceId, prorationDate }) {
        calls.push(`preview ${kind} ${priceId} ${prorationDate}`);
        return { amountDue: kind === "upgrade" ? 7320 : 18840, currency: "gbp" };
      },
      async apply({ kind, priceId, idempotencyKey }) {
        calls.push(`apply ${kind} ${priceId} ${idempotencyKey}`);
        if (failApply) throw new Error("card_declined");
        return {
          scheduleId: kind === "downgrade_scheduled" ? "sub_sched_1" : null,
          amountCharged: kind === "upgrade" ? 7320 : kind === "start_paid" ? 18840 : null,
        };
      },
      async releaseSchedule(id) {
        calls.push(`release ${id}`);
      },
    },
    records: {
      async scheduled() {
        return scheduled;
      },
      async cancelScheduled() {
        calls.push("records cancel scheduled");
        scheduled = null;
      },
      async record(change) {
        records.push(change);
        if (change.status === "scheduled") {
          scheduled = {
            id: "pc_1",
            toPriceId: change.toPriceId,
            effectiveAt: change.effectiveAt,
            scheduleId: change.scheduleId,
          };
        }
      },
    },
    async findPrice(tier, interval) {
      const amounts = { starter: 3700, standardPlus: 9600, professional: 15700 };
      return {
        id: `price_${tier}_${interval}`,
        unitAmount: interval === "annual" ? amounts[tier] * 10 : amounts[tier],
        currency: "gbp",
        interval,
      };
    },
    async syncSubscription(id) {
      calls.push(`sync ${id}`);
    },
    async notifyChanged({ planName, kind }) {
      emails.push(`${kind} ${planName}`);
    },
    now: () => NOW,
  };
  return {
    deps,
    calls,
    records,
    emails,
    setScheduled: (s: ScheduledChange | null) => (scheduled = s),
    failApply: () => (failApply = true),
  };
}

const ctx = (
  current: Partial<CurrentPlan> = {},
  team = { seatsUsed: 1, extraUsers: 0 },
): ChangeContext => ({
  orgId: "org_1",
  subscriptionId: "sub_1",
  current: {
    status: "active",
    trialing: false,
    cancelAt: null,
    priceId: "price_plus_m",
    tier: "standardPlus",
    interval: "monthly",
    custom: false,
    reviewStatus: "approved",
    ...current,
  },
  team,
  monthlyChecks: null,
});

const trialCtx = (overrides: Partial<CurrentPlan> = {}) =>
  ctx({
    status: "trialing",
    trialing: true,
    tier: "starter",
    priceId: "price_starter_m",
    ...overrides,
  });

let t: ReturnType<typeof setup>;
beforeEach(() => {
  t = setup();
});

describe("quoteChange (PLAN-05)", () => {
  it("quotes an upgrade from Stripe's preview, with the next renewal", async () => {
    const result = await quoteChange(t.deps, ctx(), {
      tier: "professional",
      interval: "monthly",
      mode: "switch",
    });
    expect(result).toEqual({
      ok: true,
      quote: {
        kind: "upgrade",
        planName: "Professional Plan",
        today: 7320,
        currency: "gbp",
        then: { amount: 15700, interval: "monthly", from: new Date("2026-12-01T00:00:00Z") },
        prorationDate: NOW_S,
        warnings: [],
      },
    });
    expect(t.calls).toEqual([`preview upgrade price_professional_monthly ${NOW_S}`]);
  });

  it("starts a new year from today when moving to annual", async () => {
    const result = await quoteChange(t.deps, ctx(), {
      tier: "standardPlus",
      interval: "annual",
      mode: "switch",
    });
    expect(result.ok && result.quote.then).toEqual({
      amount: 96000,
      interval: "annual",
      from: new Date("2027-11-12T10:00:00Z"),
    });
  });

  it("quotes nothing today for a trial switch, billing from the trial end", async () => {
    t = setup({
      status: "trialing",
      trialing: true,
      tier: "starter",
      trialEnd: new Date("2026-11-20T00:00:00Z"),
    });
    const result = await quoteChange(t.deps, trialCtx(), {
      tier: "professional",
      interval: "monthly",
      mode: "switch",
    });
    expect(result.ok && result.quote).toMatchObject({
      kind: "trial_switch",
      today: 0,
      then: { amount: 15700, from: new Date("2026-11-20T00:00:00Z") },
    });
    expect(t.calls).toEqual([]);
  });

  it("quotes nothing today for a downgrade, which starts at the period end", async () => {
    const result = await quoteChange(t.deps, ctx(), {
      tier: "starter",
      interval: "monthly",
      mode: "switch",
    });
    expect(result.ok && result.quote).toMatchObject({
      kind: "downgrade_scheduled",
      today: 0,
      then: { amount: 3700, from: new Date("2026-12-01T00:00:00Z") },
    });
  });

  it("returns the refusal for a change that isn't allowed", async () => {
    const result = await quoteChange(t.deps, ctx({}, { seatsUsed: 4, extraUsers: 0 }), {
      tier: "starter",
      interval: "monthly",
      mode: "switch",
    });
    expect(result).toMatchObject({ ok: false, classification: { reason: "seats" } });
  });
});

describe("applyChange", () => {
  const confirm = (
    c: ChangeContext,
    tier: "starter" | "standardPlus" | "professional",
    mode: "switch" | "start_paid" = "switch",
    interval: "monthly" | "annual" = "monthly",
  ) =>
    applyChange(
      t.deps,
      c,
      { tier, interval, mode },
      { actorId: "user_owner", actorKind: "owner", prorationDate: NOW_S, nonce: "n1" },
    );

  it("upgrades the existing subscription with an idempotency key, records it, syncs and emails (PLAN-01, PLAN-10)", async () => {
    expect(await confirm(ctx(), "professional")).toEqual({
      ok: true,
      kind: "upgrade",
      message: "You're now on the Professional Plan.",
    });
    expect(t.calls).toEqual([
      "apply upgrade price_professional_monthly plan-change-sub_1-n1",
      "sync sub_1",
    ]);
    expect(t.records).toEqual([
      {
        orgId: "org_1",
        actorId: "user_owner",
        actorKind: "owner",
        subscriptionId: "sub_1",
        fromPriceId: "price_plus_m",
        toPriceId: "price_professional_monthly",
        kind: "upgrade",
        effectiveAt: NOW,
        scheduleId: null,
        amountDueNow: 7320,
        currency: "gbp",
        status: "done",
      },
    ]);
    expect(t.emails).toEqual(["upgrade Professional Plan"]);
  });

  it("schedules a downgrade for the period end, without syncing now (PLAN-04)", async () => {
    const result = await confirm(ctx(), "starter");
    expect(result).toMatchObject({ ok: true, kind: "downgrade_scheduled" });
    expect(t.records[0]).toMatchObject({
      status: "scheduled",
      scheduleId: "sub_sched_1",
      effectiveAt: new Date("2026-12-01T00:00:00Z"),
    });
    expect(t.calls).not.toContain("sync sub_1");
  });

  it("replaces a scheduled change with a new one: one pending at a time", async () => {
    await confirm(ctx(), "starter");
    t.calls.length = 0;
    await confirm(ctx(), "professional");
    expect(t.calls.slice(0, 2)).toEqual(["release sub_sched_1", "records cancel scheduled"]);
  });

  it("asks for a card before starting a paid plan without one (PLAN-03)", async () => {
    t = setup({ status: "trialing", trialing: true, tier: "starter", hasPaymentMethod: false });
    expect(await confirm(trialCtx(), "professional", "start_paid")).toEqual({
      ok: false,
      needsCard: true,
    });
    expect(t.calls).toEqual([]);
  });

  it("starts paying now when there is a card", async () => {
    t = setup({ status: "trialing", trialing: true, tier: "starter" });
    const result = await confirm(trialCtx(), "professional", "start_paid", "annual");
    expect(result).toMatchObject({ ok: true, kind: "start_paid" });
    expect(t.records[0]).toMatchObject({ kind: "start_paid", amountDueNow: 18840, status: "done" });
  });

  it("records a failed payment and leaves the plan unchanged", async () => {
    t.failApply();
    const result = await confirm(ctx(), "professional");
    expect(result).toEqual({
      ok: false,
      error:
        "Your payment didn't go through, so your plan hasn't changed. Check your card in billing and try again.",
    });
    expect(t.records[0]).toMatchObject({ status: "failed", error: "card_declined" });
    expect(t.emails).toEqual([]);
  });

  it("re-checks the rules rather than trusting the form", async () => {
    const result = await confirm(ctx({}, { seatsUsed: 9, extraUsers: 0 }), "starter");
    expect(result).toMatchObject({ ok: false });
    expect(t.calls).toEqual([]);
  });

  it("refuses an expired quote", async () => {
    const result = await applyChange(
      t.deps,
      ctx(),
      { tier: "professional", interval: "monthly", mode: "switch" },
      { actorId: "u", actorKind: "owner", prorationDate: NOW_S - 31 * 60, nonce: "n" },
    );
    expect(result).toEqual({
      ok: false,
      error: "That quote has expired. Check the new amounts and confirm again.",
    });
  });
});

describe("the live subscription wins over the database", () => {
  it("classifies against Stripe's current price when the database lags", async () => {
    // The database still says Standard Plus; Stripe has already moved to Professional.
    t = setup({ priceId: "price_pro_m", tier: "professional" });
    const result = await quoteChange(t.deps, ctx(), {
      tier: "professional",
      interval: "monthly",
      mode: "switch",
    });
    expect(result).toMatchObject({ ok: false, classification: { reason: "same_plan" } });
    const down = await quoteChange(t.deps, ctx(), {
      tier: "standardPlus",
      interval: "monthly",
      mode: "switch",
    });
    expect(down.ok && down.quote.kind).toBe("downgrade_scheduled");
  });
});

describe("cancelScheduledChange (PLAN-04)", () => {
  it("releases the schedule and marks the change cancelled", async () => {
    t.setScheduled({
      id: "pc_1",
      toPriceId: "price_starter_monthly",
      effectiveAt: NOW,
      scheduleId: "sub_sched_9",
    });
    expect(await cancelScheduledChange(t.deps, { orgId: "org_1" })).toMatchObject({ ok: true });
    expect(t.calls).toEqual(["release sub_sched_9", "records cancel scheduled"]);
    expect(await cancelScheduledChange(t.deps, { orgId: "org_1" })).toMatchObject({ ok: false });
  });
});
