import { describe, expect, it } from "vitest";

import type { LiveSubscription, PlanChangeRecord } from "@/lib/billing/plan-change";
import type { Product } from "@/lib/billing/subscription-record";

import { memoryAudit } from "./audit";
import {
  type AdminChangeRequest,
  type AdminPrice,
  type AdminSubscriptionDeps,
  applyAdminChange,
  cancelSubscription,
  checkAdminChange,
  extendTrial,
  quoteAdminChange,
  setExtraSeats,
  undoCancellation,
} from "./subscription-changes";

const NOW = new Date("2026-06-01T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

type Sub = LiveSubscription & { product: Product; extraUsers: number };

const sub = (overrides: Partial<Sub> = {}): Sub => ({
  id: "sub_1",
  customerId: "cus_1",
  itemId: "si_1",
  priceId: "price_starter",
  status: "active",
  trialing: false,
  trialEnd: null,
  currentPeriodStart: new Date("2026-05-15T00:00:00Z"),
  currentPeriodEnd: new Date("2026-06-15T00:00:00Z"),
  scheduleId: null,
  hasPaymentMethod: true,
  cancelAt: null,
  tier: "starter",
  interval: "monthly",
  custom: false,
  product: "bank_checker",
  extraUsers: 0,
  ...overrides,
});

const custom: AdminPrice = {
  id: "price_custom",
  name: "Acme custom",
  active: true,
  unitAmount: 50000,
  currency: "gbp",
  recurring: { interval: "year", count: 1 },
  product: "bank_checker",
  maxTeamSize: 10,
};

const request = (overrides: Partial<AdminChangeRequest> = {}): AdminChangeRequest => ({
  priceId: "price_custom",
  trial: "keep",
  trialEnd: null,
  proration: "create_prorations",
  when: "now",
  ...overrides,
});

const ctx = { orgId: "org_1", subscriptionId: "sub_1", seatsUsed: 2 };

function deps(options: { sub?: Sub; price?: AdminPrice | null; fail?: boolean } = {}) {
  const calls: string[] = [];
  const records: PlanChangeRecord[] = [];
  const audit = memoryAudit();
  const fail = async () => {
    if (options.fail) throw new Error("card declined");
  };
  const d: AdminSubscriptionDeps = {
    stripe: {
      getSubscription: async () => options.sub ?? sub(),
      getPrice: async () => (options.price === undefined ? custom : options.price),
      preview: async () => ({ amountDue: 1234, currency: "gbp" }),
      updateNow: async (input) => {
        await fail();
        calls.push(`update ${input.priceId} ${input.proration} ${String(input.trialEnd)}`);
        return { amountCharged: 1234 };
      },
      scheduleAtRenewal: async (input) => {
        await fail();
        calls.push(`schedule ${input.price.id}`);
        return { scheduleId: "sched_1" };
      },
      releaseSchedule: async (id) => void calls.push(`release ${id}`),
      setExtraUsers: async (_id, n) => {
        await fail();
        calls.push(`seats ${n}`);
      },
      setTrialEnd: async (_id, date) => {
        await fail();
        calls.push(`trial ${date.toISOString()}`);
      },
      cancel: async (_id, when) => {
        await fail();
        calls.push(`cancel ${when}`);
      },
      undoCancel: async () => void calls.push("undo cancel"),
    },
    records: {
      scheduled: async () => null,
      cancelScheduled: async () => void calls.push("cancel scheduled"),
      record: async (change) => void records.push(change),
    },
    syncSubscription: async () => void calls.push("sync"),
    notifyOwner: async () => void calls.push("email owner"),
    audit,
    now: () => NOW,
  };
  return { deps: d, calls, records, audit };
}

const prorationDate = Math.floor(NOW.getTime() / 1000);

describe("checkAdminChange (PLAN-09)", () => {
  it("allows any price for the same product, including custom ones", () => {
    expect(checkAdminChange(sub(), custom, request(), { seatsUsed: 2 }, NOW).errors).toEqual([]);
  });

  it("refuses a price for another product, or no change at all", () => {
    const eiscd = { ...custom, product: "eiscd" as const };
    expect(checkAdminChange(sub(), eiscd, request(), { seatsUsed: 1 }, NOW).errors[0]).toContain(
      "different product",
    );
    const same = { ...custom, id: "price_starter" };
    expect(
      checkAdminChange(sub(), same, request({ priceId: "price_starter" }), { seatsUsed: 1 }, NOW)
        .errors[0],
    ).toContain("nothing to change");
  });

  it("checks the trial options", () => {
    const trial = sub({
      status: "trialing",
      trialing: true,
      trialEnd: new Date(NOW.getTime() + 5 * DAY),
    });
    expect(
      checkAdminChange(sub(), custom, request({ trial: "end" }), { seatsUsed: 1 }, NOW).errors,
    ).toContain("The subscription isn't on a trial.");
    expect(
      checkAdminChange(
        trial,
        custom,
        request({ trial: "extend", trialEnd: new Date(NOW.getTime() - DAY) }),
        { seatsUsed: 1 },
        NOW,
      ).errors,
    ).toContain("Choose a new trial end in the future.");
    expect(
      checkAdminChange(
        trial,
        custom,
        request({ trial: "extend", trialEnd: new Date(NOW.getTime() + 30 * DAY) }),
        { seatsUsed: 1 },
        NOW,
      ).errors,
    ).toEqual([]);
    expect(
      checkAdminChange(trial, custom, request({ when: "renewal" }), { seatsUsed: 1 }, NOW).errors
        .length,
    ).toBeGreaterThan(0);
  });

  it("warns, but allows, a price with fewer seats than the team uses", () => {
    const small = { ...custom, maxTeamSize: 1 };
    const result = checkAdminChange(sub(), small, request(), { seatsUsed: 3 }, NOW);
    expect(result.errors).toEqual([]);
    expect(result.warnings[0]).toContain("team uses 3");
  });
});

describe("quoteAdminChange and applyAdminChange (PLAN-09)", () => {
  it("quotes from Stripe's preview when applied now", async () => {
    const { deps: d, calls } = deps();
    const quote = await quoteAdminChange(d, ctx, request());
    expect(quote).toMatchObject({ ok: true, quote: { today: 1234, planName: "Acme custom" } });
    expect(calls).toEqual([]);
  });

  it("quotes no charge today at renewal, from the period end", async () => {
    const { deps: d } = deps();
    const quote = await quoteAdminChange(d, ctx, request({ when: "renewal" }));
    expect(quote).toMatchObject({
      ok: true,
      quote: { today: null, effectiveAt: sub().currentPeriodEnd },
    });
  });

  it("applies now: Stripe, the record, the audit entry, a sync and the owner's email", async () => {
    const { deps: d, calls, records, audit } = deps();
    const result = await applyAdminChange(d, ctx, request(), {
      actorId: "admin_1",
      prorationDate,
      nonce: "n1",
    });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["update price_custom create_prorations null", "sync", "email owner"]);
    expect(records[0]).toMatchObject({ kind: "admin_change", actorKind: "admin", status: "done" });
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      action: "subscription.change_plan",
      actorId: "admin_1",
      before: { price_id: "price_starter" },
      after: { price_id: "price_custom" },
    });
  });

  it("schedules a change at renewal and records it as scheduled", async () => {
    const { deps: d, calls, records } = deps();
    const result = await applyAdminChange(d, ctx, request({ when: "renewal" }), {
      actorId: "admin_1",
      prorationDate,
      nonce: "n1",
    });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["schedule price_custom", "email owner"]);
    expect(records[0]).toMatchObject({ status: "scheduled", scheduleId: "sched_1" });
  });

  it("records and audits a change Stripe refuses", async () => {
    const { deps: d, records, audit } = deps({ fail: true });
    const result = await applyAdminChange(d, ctx, request(), {
      actorId: "admin_1",
      prorationDate,
      nonce: "n1",
    });
    expect(result).toMatchObject({ ok: false });
    expect(records[0]).toMatchObject({ status: "failed" });
    expect(audit.entries.map((e) => e.action)).toEqual(["subscription.failed"]);
  });

  it("refuses an expired preview", async () => {
    const { deps: d, calls } = deps();
    const result = await applyAdminChange(d, ctx, request(), {
      actorId: "admin_1",
      prorationDate: prorationDate - 31 * 60,
      nonce: "n1",
    });
    expect(result).toMatchObject({ ok: false });
    expect(calls).toEqual([]);
  });
});

describe("other admin subscription changes (plan §6.8, PLAN-11)", () => {
  it("sets extra seats, syncs and audits", async () => {
    const { deps: d, calls, audit } = deps();
    const result = await setExtraSeats(d, ctx, { actorId: "admin_1", extraUsers: 3, nonce: "n" });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["seats 3", "sync"]);
    expect(audit.entries[0]).toMatchObject({
      action: "subscription.extra_seats",
      before: { extra_users: 0 },
      after: { extra_users: 3 },
    });
  });

  it("refuses nonsense seat counts", async () => {
    const { deps: d, audit } = deps();
    expect((await setExtraSeats(d, ctx, { actorId: "a", extraUsers: -1, nonce: "n" })).ok).toBe(
      false,
    );
    expect(audit.entries).toEqual([]);
  });

  it("extends a trial to a later date", async () => {
    const trialEnd = new Date(NOW.getTime() + 3 * DAY);
    const {
      deps: d,
      calls,
      audit,
    } = deps({
      sub: sub({ status: "trialing", trialing: true, trialEnd }),
    });
    const later = new Date(NOW.getTime() + 20 * DAY);
    expect((await extendTrial(d, ctx, { actorId: "a", trialEnd: later, nonce: "n" })).ok).toBe(
      true,
    );
    expect(calls).toEqual([`trial ${later.toISOString()}`, "sync"]);
    expect(audit.entries[0].action).toBe("subscription.extend_trial");
    const earlier = new Date(NOW.getTime() + DAY);
    expect((await extendTrial(d, ctx, { actorId: "a", trialEnd: earlier, nonce: "n" })).ok).toBe(
      false,
    );
  });

  it("cancels now or at period end, and undoes a pending cancellation", async () => {
    const { deps: d, calls, audit } = deps();
    expect((await cancelSubscription(d, ctx, { actorId: "a", when: "now", nonce: "n" })).ok).toBe(
      true,
    );
    expect(calls).toEqual(["cancel now", "sync"]);
    expect(audit.entries[0]).toMatchObject({
      action: "subscription.cancel",
      after: { when: "now" },
    });

    const cancelling = deps({ sub: sub({ cancelAt: new Date("2026-06-15T00:00:00Z") }) });
    expect((await undoCancellation(cancelling.deps, ctx, { actorId: "a" })).ok).toBe(true);
    expect(cancelling.audit.entries[0].action).toBe("subscription.undo_cancel");
  });

  it("audits a failed Stripe write and changes nothing else", async () => {
    const { deps: d, calls, audit } = deps({ fail: true });
    const result = await cancelSubscription(d, ctx, {
      actorId: "a",
      when: "period_end",
      nonce: "n",
    });
    expect(result.ok).toBe(false);
    expect(calls).toEqual([]);
    expect(audit.entries[0]).toMatchObject({
      action: "subscription.failed",
      details: { change: "subscription.cancel" },
    });
  });
});
