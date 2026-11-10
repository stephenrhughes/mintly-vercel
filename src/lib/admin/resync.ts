// Resync from Stripe (ADM-05, ADM-06), ported from mintly-web
// adminCustomers/src/resync.js. Pure: it works out what a resync would
// change, from the stored row, Stripe's current record and the key's real
// state in API Gateway. resync-server.ts carries it out.
//
// The key is never replaced, so integrations and team members keep working.
// Key actions follow the AWS reality rather than api_keys, so a key that
// was moved or enabled by hand is put back exactly where it belongs.

import { createHash } from "node:crypto";

import type { ReviewStatus } from "@/lib/nav";
import { isLiveStatus, type SubscriptionRecord } from "@/lib/billing/subscription-record";

import { type DriftField, driftFields, type StoredSubscriptionRow } from "./drift";

/** The key as API Gateway has it. */
export type AwsKeyState = { exists: boolean; enabled: boolean; plans: string[] };

/** The key as api_keys records it. */
export type StoredKey = {
  id: string;
  enabled: boolean;
  usagePlanId: string | null;
  /** An admin turned it off; resync leaves it off (plan §6.8). */
  disabledByAdmin: boolean;
};

export type ResyncKeyAction =
  | { type: "add_to_plan"; keyId: string; usagePlanId: string }
  | { type: "remove_from_plan"; keyId: string; usagePlanId: string }
  | { type: "enable"; keyId: string }
  | { type: "disable"; keyId: string };

export type ResyncBlocker =
  | "no_record"
  | "no_subscription"
  | "other_customer"
  | "missing_plan_metadata"
  | "no_key"
  | "key_deleted";

export const blockerText: Record<ResyncBlocker, string> = {
  no_record: "There is no stored subscription record to resync.",
  no_subscription: "Stripe has no such subscription.",
  other_customer: "The Stripe subscription belongs to a different customer.",
  missing_plan_metadata:
    "The price is missing usagePlanId or trialUsagePlanId metadata. Fix the price in Stripe first.",
  no_key:
    "The organisation should have an API key but has none. It is created on the next Stripe event.",
  key_deleted: "The API key no longer exists in API Gateway.",
};

/** Where the key should be: enabled or not, and in exactly these usage plans. */
export type KeyTarget = { enabled: boolean; plans: string[] };

export type ResyncInput = {
  orgStripeCustomerId: string | null;
  reviewStatus: ReviewStatus;
  stored: StoredSubscriptionRow | null;
  /** Stripe's current record, or null when Stripe has no such subscription. */
  live: SubscriptionRecord | null;
  key: StoredKey | null;
  aws: AwsKeyState | null;
};

export type ResyncPlan = {
  changes: DriftField[];
  keyTarget: KeyTarget | null;
  keyActions: ResyncKeyAction[];
  blockers: ResyncBlocker[];
  /** Changes when the stored row or key changes, so a stale preview isn't applied. */
  fingerprint: string;
};

/**
 * Where the key belongs, or null when resync should leave it alone (the
 * same rules as provisioning, key-plan.ts, plus an admin's own switch-off).
 */
export function keyTarget(
  record: SubscriptionRecord,
  reviewStatus: ReviewStatus,
  key: StoredKey | null,
): KeyTarget | null {
  const off: KeyTarget = { enabled: false, plans: [] };
  if (record.expired) return record.replacedByUpgrade ? null : off;
  if (!isLiveStatus(record.status)) return null;
  if (reviewStatus === "pending_review") return null;
  if (reviewStatus === "rejected" || reviewStatus === "suspended") return off;
  if (key?.disabledByAdmin) return off;
  if (!record.usagePlanId) return null;
  return { enabled: true, plans: [record.usagePlanId] };
}

export function fingerprintOf(stored: StoredSubscriptionRow | null, key: StoredKey | null): string {
  const text = JSON.stringify({ stored, key });
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

export function planResync(input: ResyncInput): ResyncPlan {
  const { stored, live, key, aws } = input;
  const blockers: ResyncBlocker[] = [];
  const fingerprint = fingerprintOf(stored, key);
  const empty = { changes: [], keyTarget: null, keyActions: [], fingerprint };

  if (!stored) return { ...empty, blockers: ["no_record"] };
  if (!live) return { ...empty, blockers: ["no_subscription"] };
  if (input.orgStripeCustomerId && live.stripeCustomerId !== input.orgStripeCustomerId) {
    return { ...empty, blockers: ["other_customer"] };
  }
  if (live.missingPlanMetadata && !live.expired) blockers.push("missing_plan_metadata");

  const changes = driftFields(stored, live);
  const target = blockers.length ? null : keyTarget(live, input.reviewStatus, key);

  const keyActions: ResyncKeyAction[] = [];
  if (target) {
    if (!key) {
      if (target.enabled) blockers.push("no_key");
    } else if (aws && !aws.exists) {
      blockers.push("key_deleted");
    } else if (aws) {
      const id = key.id;
      const adds = target.plans.filter((plan) => !aws.plans.includes(plan));
      const removes = aws.plans.filter((plan) => !target.plans.includes(plan));
      // Into the right plan before leaving the wrong one, so a live key is
      // never planless; switched off before it leaves its plans.
      for (const plan of adds)
        keyActions.push({ type: "add_to_plan", keyId: id, usagePlanId: plan });
      if (target.enabled && !aws.enabled) keyActions.push({ type: "enable", keyId: id });
      if (!target.enabled && aws.enabled) keyActions.push({ type: "disable", keyId: id });
      for (const plan of removes) {
        keyActions.push({ type: "remove_from_plan", keyId: id, usagePlanId: plan });
      }
    }
  }

  // The key row should match the target too.
  if (target && key && !blockers.length) {
    const plan = target.plans[0] ?? null;
    if (key.enabled !== target.enabled) {
      changes.push({
        field: "api_keys.enabled",
        label: "Key enabled",
        stored: String(key.enabled),
        expected: String(target.enabled),
      });
    }
    if (key.usagePlanId !== plan) {
      changes.push({
        field: "api_keys.usage_plan_id",
        label: "Key usage plan",
        stored: key.usagePlanId,
        expected: plan,
      });
    }
  }

  return {
    changes,
    keyTarget: blockers.length ? null : target,
    keyActions: blockers.length ? [] : keyActions,
    blockers,
    fingerprint,
  };
}

export function describeKeyAction(action: ResyncKeyAction): string {
  switch (action.type) {
    case "add_to_plan":
      return `Add the key to usage plan ${action.usagePlanId}`;
    case "remove_from_plan":
      return `Remove the key from usage plan ${action.usagePlanId}`;
    case "enable":
      return "Enable the key";
    case "disable":
      return "Disable the key";
  }
}
