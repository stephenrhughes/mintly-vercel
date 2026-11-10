import { describe, expect, it } from "vitest";

import { subscription, TRIAL_PLAN } from "@/lib/billing/fixtures";
import { deriveSubscriptionRecord } from "@/lib/billing/subscription-record";

import { memoryAudit } from "./audit";
import { applyResync, previewResync, type ResyncDeps } from "./resync-apply";
import { fingerprintOf } from "./resync";

const record = deriveSubscriptionRecord(subscription());

function deps(overrides: Partial<ResyncDeps> = {}) {
  const calls: string[] = [];
  const audit = memoryAudit();
  const stored = {
    orgId: "org_1",
    product: record.product,
    stripeSubscriptionId: record.stripeSubscriptionId,
    stripeSubscriptionItemId: record.stripeSubscriptionItemId,
    stripePriceId: record.stripePriceId,
    status: record.status,
    trialing: record.trialing,
    trialEnd: record.trialEnd,
    currentPeriodEnd: record.currentPeriodEnd,
    cancelAt: record.cancelAt,
    expired: record.expired,
    maxTeamSize: record.maxTeamSize,
    extraUsers: record.extraUsers,
    usagePlanId: record.usagePlanId,
    apiKeyId: "key_1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedFromStripeAt: null,
  };
  const key = { id: "key_1", enabled: true, usagePlanId: TRIAL_PLAN, disabledByAdmin: false };
  const d: ResyncDeps = {
    load: async () => ({
      orgId: "org_1",
      orgName: "Acme",
      orgStripeCustomerId: "cus_1",
      reviewStatus: "approved",
      stored,
      key,
    }),
    retrieveLive: async () => record,
    // The key was left in the trial plan by hand.
    awsKey: async () => ({ exists: true, enabled: true, plans: [TRIAL_PLAN] }),
    keys: {
      addToPlan: async (_k, plan) => void calls.push(`add ${plan}`),
      removeFromPlan: async (_k, plan) => void calls.push(`remove ${plan}`),
      setEnabled: async (_k, on) => void calls.push(on ? "enable" : "disable"),
    },
    saveKeyRow: async () => void calls.push("save key"),
    syncSubscription: async () => void calls.push("sync"),
    audit,
    ...overrides,
  };
  return { deps: d, calls, audit, fingerprint: fingerprintOf(stored, key) };
}

describe("applyResync (ADM-05, ADM-07)", () => {
  it("previews the changes without making them", async () => {
    const { deps: d, calls, audit } = deps();
    const preview = await previewResync(d, { orgId: "org_1", subscriptionId: "sub_1" });
    expect(preview.ok && preview.plan.keyActions.length).toBe(2);
    expect(calls).toEqual([]);
    expect(audit.entries).toEqual([]);
  });

  it("runs key actions, then the record, and audits it", async () => {
    const { deps: d, calls, audit, fingerprint } = deps();
    const result = await applyResync(d, {
      orgId: "org_1",
      subscriptionId: "sub_1",
      fingerprint,
      actorId: "admin_1",
    });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["add plan_paid", "remove plan_trial", "save key", "sync"]);
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      actorId: "admin_1",
      orgId: "org_1",
      action: "resync.apply",
    });
  });

  it("refuses a stale preview", async () => {
    const { deps: d, calls } = deps();
    const result = await applyResync(d, {
      orgId: "org_1",
      subscriptionId: "sub_1",
      fingerprint: "stale",
      actorId: "admin_1",
    });
    expect(result).toMatchObject({ ok: false });
    expect(calls).toEqual([]);
  });

  it("stops before the record when a key action fails, and audits the failure", async () => {
    const { deps: base, audit, fingerprint } = deps();
    const calls: string[] = [];
    const d: ResyncDeps = {
      ...base,
      keys: {
        ...base.keys,
        addToPlan: async () => void calls.push("add"),
        removeFromPlan: async () => {
          throw new Error("AWS said no");
        },
      },
      syncSubscription: async () => void calls.push("sync"),
    };
    const result = await applyResync(d, {
      orgId: "org_1",
      subscriptionId: "sub_1",
      fingerprint,
      actorId: "admin_1",
    });
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toContain("AWS said no");
    expect(calls).toEqual(["add"]);
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({ action: "resync.failed" });
  });
});
