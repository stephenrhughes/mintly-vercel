import { describe, expect, it } from "vitest";

import { PAID_PLAN, subscription, TRIAL_PLAN } from "./fixtures";
import { type KeyState, planKeyActions } from "./key-plan";
import {
  deriveSubscriptionRecord,
  type SubscriptionLike,
  UPGRADE_CANCELLATION_COMMENT,
} from "./subscription-record";

const record = (overrides: Partial<SubscriptionLike> = {}) =>
  deriveSubscriptionRecord(subscription(overrides));

const key = (overrides: Partial<KeyState> = {}): KeyState => ({
  id: "key_1",
  enabled: true,
  usagePlanId: TRIAL_PLAN,
  ...overrides,
});

describe("planKeyActions", () => {
  it("creates a key in the trial plan for a new approved trial (PROV-01)", () => {
    expect(
      planKeyActions({
        record: record({ status: "trialing" }),
        reviewStatus: "approved",
        key: null,
      }),
    ).toEqual([{ type: "create", usagePlanId: TRIAL_PLAN }]);
  });

  it("creates no key while the organisation is pending review (APPR-01)", () => {
    expect(
      planKeyActions({
        record: record({ status: "trialing" }),
        reviewStatus: "pending_review",
        key: null,
      }),
    ).toEqual([]);
  });

  it("reuses the key when the same event arrives again (NFR-04)", () => {
    expect(
      planKeyActions({
        record: record({ status: "trialing" }),
        reviewStatus: "approved",
        key: key(),
      }),
    ).toEqual([]);
  });

  it("moves the key to the paid plan when the trial converts (PROV-04)", () => {
    expect(planKeyActions({ record: record(), reviewStatus: "approved", key: key() })).toEqual([
      { type: "move", keyId: "key_1", from: TRIAL_PLAN, to: PAID_PLAN },
    ]);
  });

  it("moves the key when the price changes to another usage plan (PROV-05)", () => {
    expect(
      planKeyActions({
        record: record(),
        reviewStatus: "approved",
        key: key({ usagePlanId: "plan_old" }),
      }),
    ).toEqual([{ type: "move", keyId: "key_1", from: "plan_old", to: PAID_PLAN }]);
  });

  it("disables the key and removes it from its plan when the subscription ends (PROV-07)", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired"]) {
      expect(
        planKeyActions({
          record: record({ status }),
          reviewStatus: "approved",
          key: key({ usagePlanId: PAID_PLAN }),
        }),
      ).toEqual([{ type: "disable", keyId: "key_1", usagePlanId: PAID_PLAN }]);
    }
  });

  it("leaves the key alone when the subscription was replaced by an upgrade (PROV-07)", () => {
    expect(
      planKeyActions({
        record: record({
          status: "canceled",
          cancellation_details: { comment: UPGRADE_CANCELLATION_COMMENT },
        }),
        reviewStatus: "approved",
        key: key(),
      }),
    ).toEqual([]);
  });

  it("does nothing more once an ended subscription's key is already off", () => {
    expect(
      planKeyActions({
        record: record({ status: "canceled" }),
        reviewStatus: "approved",
        key: key({ enabled: false, usagePlanId: null }),
      }),
    ).toEqual([]);
  });

  it("re-enables a disabled key in the right plan", () => {
    expect(
      planKeyActions({
        record: record(),
        reviewStatus: "approved",
        key: key({ enabled: false, usagePlanId: null }),
      }),
    ).toEqual([{ type: "enable", keyId: "key_1", usagePlanId: PAID_PLAN }]);
  });

  it("keeps a key an admin switched off off, whatever the subscription (plan §6.8)", () => {
    const live = record({ status: "active" });
    expect(
      planKeyActions({
        record: live,
        reviewStatus: "approved",
        key: key({ enabled: false, usagePlanId: null, disabledByAdmin: true }),
      }),
    ).toEqual([]);
    expect(
      planKeyActions({
        record: live,
        reviewStatus: "approved",
        key: key({ usagePlanId: PAID_PLAN, disabledByAdmin: true }),
      }),
    ).toEqual([{ type: "disable", keyId: "key_1", usagePlanId: PAID_PLAN }]);
  });

  it("disables the key of a suspended or rejected organisation (APPR-08)", () => {
    for (const reviewStatus of ["suspended", "rejected"] as const) {
      expect(planKeyActions({ record: record(), reviewStatus, key: key() })).toEqual([
        { type: "disable", keyId: "key_1", usagePlanId: TRIAL_PLAN },
      ]);
    }
  });

  it("keeps the key of a past-due subscription live (BILL-06)", () => {
    expect(
      planKeyActions({
        record: record({ status: "past_due" }),
        reviewStatus: "approved",
        key: key({ usagePlanId: PAID_PLAN }),
      }),
    ).toEqual([]);
  });

  it("waits while a subscription is incomplete", () => {
    expect(
      planKeyActions({
        record: record({ status: "incomplete" }),
        reviewStatus: "approved",
        key: null,
      }),
    ).toEqual([]);
  });
});
