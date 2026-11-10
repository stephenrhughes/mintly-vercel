import { describe, expect, it } from "vitest";

import { PAID_PLAN, PERIOD_END, subscription, TRIAL_PLAN } from "@/lib/billing/fixtures";
import {
  deriveSubscriptionRecord,
  type SubscriptionRecord,
  UPGRADE_CANCELLATION_COMMENT,
} from "@/lib/billing/subscription-record";

import { driftFields, type StoredSubscriptionRow } from "./drift";
import { type AwsKeyState, planResync, type ResyncInput, type StoredKey } from "./resync";

const live = (overrides: Parameters<typeof subscription>[0] = {}): SubscriptionRecord =>
  deriveSubscriptionRecord(subscription(overrides));

/** The stored row that matches a record exactly. */
function storedFrom(record: SubscriptionRecord, overrides: Partial<StoredSubscriptionRow> = {}) {
  return {
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
    updatedFromStripeAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  } satisfies StoredSubscriptionRow;
}

const key = (overrides: Partial<StoredKey> = {}): StoredKey => ({
  id: "key_1",
  enabled: true,
  usagePlanId: PAID_PLAN,
  disabledByAdmin: false,
  ...overrides,
});

const aws = (overrides: Partial<AwsKeyState> = {}): AwsKeyState => ({
  exists: true,
  enabled: true,
  plans: [PAID_PLAN],
  ...overrides,
});

function input(overrides: Partial<ResyncInput> = {}): ResyncInput {
  const record = live();
  return {
    orgStripeCustomerId: "cus_1",
    reviewStatus: "approved",
    stored: storedFrom(record),
    live: record,
    key: key(),
    aws: aws(),
    ...overrides,
  };
}

describe("driftFields (ADM-03)", () => {
  it("finds nothing when the row matches Stripe", () => {
    const record = live();
    expect(driftFields(storedFrom(record), record)).toEqual([]);
  });

  it("lists each field that differs, with both values", () => {
    const record = live({ status: "past_due", metadata: { extraUsers: "2" } });
    const drift = driftFields(storedFrom(live()), record);
    expect(drift.map((d) => d.field)).toEqual(["status", "extra_users"]);
    expect(drift[0]).toMatchObject({ stored: "active", expected: "past_due" });
  });

  it("ignores milliseconds in dates", () => {
    const record = live();
    const stored = storedFrom(record, { currentPeriodEnd: new Date(PERIOD_END * 1000 + 400) });
    expect(driftFields(stored, record)).toEqual([]);
  });
});

describe("planResync (ADM-05, ADM-06)", () => {
  it("does nothing when everything is in line", () => {
    const plan = planResync(input());
    expect(plan).toMatchObject({ changes: [], keyActions: [], blockers: [] });
  });

  it("puts the key in exactly the expected usage plan", () => {
    const plan = planResync(input({ aws: aws({ plans: [TRIAL_PLAN, "plan_other"] }) }));
    expect(plan.keyActions).toEqual([
      { type: "add_to_plan", keyId: "key_1", usagePlanId: PAID_PLAN },
      { type: "remove_from_plan", keyId: "key_1", usagePlanId: TRIAL_PLAN },
      { type: "remove_from_plan", keyId: "key_1", usagePlanId: "plan_other" },
    ]);
  });

  it("enables the key while the subscription is live", () => {
    const plan = planResync(input({ aws: aws({ enabled: false, plans: [] }) }));
    expect(plan.keyActions).toEqual([
      { type: "add_to_plan", keyId: "key_1", usagePlanId: PAID_PLAN },
      { type: "enable", keyId: "key_1" },
    ]);
  });

  it("disables the key and takes it out of every plan once ended", () => {
    const ended = live({ status: "canceled", ended_at: PERIOD_END });
    const plan = planResync(input({ live: ended, stored: storedFrom(live()) }));
    expect(plan.keyActions).toEqual([
      { type: "disable", keyId: "key_1" },
      { type: "remove_from_plan", keyId: "key_1", usagePlanId: PAID_PLAN },
    ]);
    expect(plan.changes.map((c) => c.field)).toContain("expired");
    expect(plan.changes.map((c) => c.field)).toContain("api_keys.enabled");
  });

  it("leaves the key of a subscription replaced by an upgrade alone (PROV-07)", () => {
    const replaced = live({
      status: "canceled",
      ended_at: PERIOD_END,
      cancellation_details: { comment: UPGRADE_CANCELLATION_COMMENT },
    });
    expect(planResync(input({ live: replaced })).keyActions).toEqual([]);
  });

  it("keeps a key an admin switched off off", () => {
    const plan = planResync(
      input({
        key: key({ enabled: false, usagePlanId: null, disabledByAdmin: true }),
        aws: aws({ enabled: false, plans: [] }),
      }),
    );
    expect(plan.keyActions).toEqual([]);
    expect(plan.blockers).toEqual([]);
  });

  it("leaves a pending review's key alone", () => {
    const plan = planResync(input({ reviewStatus: "pending_review", key: null, aws: null }));
    expect(plan.blockers).toEqual([]);
    expect(plan.keyActions).toEqual([]);
  });

  it("is blocked without a stored record", () => {
    expect(planResync(input({ stored: null })).blockers).toEqual(["no_record"]);
  });

  it("is blocked when Stripe has no such subscription", () => {
    expect(planResync(input({ live: null })).blockers).toEqual(["no_subscription"]);
  });

  it("is blocked when the subscription belongs to another customer", () => {
    expect(planResync(input({ orgStripeCustomerId: "cus_other" })).blockers).toEqual([
      "other_customer",
    ]);
  });

  it("is blocked by a price missing its usage plan metadata", () => {
    const record = live({ price: { id: "price_x", metadata: { tier: "starter" } } });
    const plan = planResync(input({ live: record }));
    expect(plan.blockers).toEqual(["missing_plan_metadata"]);
    expect(plan.keyActions).toEqual([]);
  });

  it("is blocked when a live subscription has no key, or its key was deleted", () => {
    expect(planResync(input({ key: null, aws: null })).blockers).toEqual(["no_key"]);
    expect(planResync(input({ aws: aws({ exists: false, plans: [] }) })).blockers).toEqual([
      "key_deleted",
    ]);
  });

  it("allows EISCD subscriptions (plan §6.7)", () => {
    const eiscd = live({
      price: { id: "price_eiscd", metadata: { product: "eiscd", usagePlanId: "plan_eiscd" } },
    });
    const plan = planResync(
      input({
        live: eiscd,
        stored: storedFrom(eiscd),
        key: key({ usagePlanId: "plan_eiscd" }),
        aws: aws({ plans: ["plan_eiscd"] }),
      }),
    );
    expect(plan.blockers).toEqual([]);
    expect(plan.keyActions).toEqual([]);
  });

  it("gives a fingerprint that changes with the stored record", () => {
    const a = planResync(input()).fingerprint;
    expect(planResync(input()).fingerprint).toBe(a);
    const record = live();
    expect(
      planResync(input({ stored: storedFrom(record, { status: "past_due" }) })).fingerprint,
    ).not.toBe(a);
  });
});
