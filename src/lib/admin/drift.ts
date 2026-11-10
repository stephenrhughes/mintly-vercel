// Drift: where the stored subscription row disagrees with what Stripe says
// it should be (ADM-03). Pure, so the organisations list, the detail page
// and the resync preview all agree on what counts.

import type { SubscriptionRecord } from "@/lib/billing/subscription-record";

/** A row of public.subscriptions, as the admin pages read it. */
export type StoredSubscriptionRow = {
  orgId: string;
  product: "bank_checker" | "eiscd";
  stripeSubscriptionId: string;
  stripeSubscriptionItemId: string | null;
  stripePriceId: string;
  status: string;
  trialing: boolean;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  expired: boolean;
  maxTeamSize: number | null;
  extraUsers: number;
  usagePlanId: string | null;
  apiKeyId: string | null;
  createdAt: Date;
  updatedFromStripeAt: Date | null;
};

export type DriftField = {
  field: string;
  label: string;
  stored: string | null;
  expected: string | null;
};

type Comparable = string | number | boolean | Date | null;

const show = (value: Comparable): string | null => {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().replace(/\.\d{3}Z$/, "Z");
  return String(value);
};

const FIELDS: Array<{
  field: string;
  label: string;
  stored: (row: StoredSubscriptionRow) => Comparable;
  expected: (record: SubscriptionRecord) => Comparable;
}> = [
  { field: "status", label: "Status", stored: (r) => r.status, expected: (r) => r.status },
  {
    field: "stripe_price_id",
    label: "Price",
    stored: (r) => r.stripePriceId,
    expected: (r) => r.stripePriceId,
  },
  {
    field: "stripe_subscription_item_id",
    label: "Subscription item",
    stored: (r) => r.stripeSubscriptionItemId,
    expected: (r) => r.stripeSubscriptionItemId,
  },
  { field: "trialing", label: "Trialing", stored: (r) => r.trialing, expected: (r) => r.trialing },
  {
    field: "trial_end",
    label: "Trial end",
    stored: (r) => r.trialEnd,
    expected: (r) => r.trialEnd,
  },
  {
    field: "current_period_end",
    label: "Period end",
    stored: (r) => r.currentPeriodEnd,
    expected: (r) => r.currentPeriodEnd,
  },
  { field: "cancel_at", label: "Ends", stored: (r) => r.cancelAt, expected: (r) => r.cancelAt },
  { field: "expired", label: "Expired", stored: (r) => r.expired, expected: (r) => r.expired },
  {
    field: "max_team_size",
    label: "Seats in plan",
    stored: (r) => r.maxTeamSize,
    expected: (r) => r.maxTeamSize,
  },
  {
    field: "extra_users",
    label: "Extra seats",
    stored: (r) => r.extraUsers,
    expected: (r) => r.extraUsers,
  },
  {
    field: "usage_plan_id",
    label: "Usage plan",
    stored: (r) => r.usagePlanId,
    expected: (r) => r.usagePlanId,
  },
];

/** Every compared field, side by side, for the detail page (ADM-03). */
export function compareFields(
  stored: StoredSubscriptionRow | null,
  expected: SubscriptionRecord | null,
): Array<DriftField & { differs: boolean }> {
  return FIELDS.map((f) => {
    const a = stored ? show(f.stored(stored)) : null;
    const b = expected ? show(f.expected(expected)) : null;
    return {
      field: f.field,
      label: f.label,
      stored: a,
      expected: b,
      differs: Boolean(stored && expected) && a !== b,
    };
  });
}

/** The fields that differ between the stored row and Stripe's record. */
export function driftFields(
  stored: StoredSubscriptionRow,
  expected: SubscriptionRecord,
): DriftField[] {
  return compareFields(stored, expected)
    .filter((f) => f.differs)
    .map(({ field, label, stored: a, expected: b }) => ({ field, label, stored: a, expected: b }));
}
