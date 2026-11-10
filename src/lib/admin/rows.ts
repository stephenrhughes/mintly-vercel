// Mapping database rows for the admin pages. Shared by the organisation
// queries and the resync.

import type { StoredSubscriptionRow } from "./drift";
import type { StoredKey } from "./resync";

export const SUBSCRIPTION_COLUMNS =
  "org_id, product, stripe_subscription_id, stripe_subscription_item_id, stripe_price_id, status, trialing, trial_end, current_period_end, cancel_at, expired, max_team_size, extra_users, usage_plan_id, api_key_id, created_at, updated_from_stripe_at";

export type SubscriptionDbRow = {
  org_id: string;
  product: "bank_checker" | "eiscd";
  stripe_subscription_id: string;
  stripe_subscription_item_id: string | null;
  stripe_price_id: string;
  status: string;
  trialing: boolean;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  expired: boolean;
  max_team_size: number | null;
  extra_users: number;
  usage_plan_id: string | null;
  api_key_id: string | null;
  created_at: string;
  updated_from_stripe_at: string | null;
};

const date = (value: string | null) => (value ? new Date(value) : null);

export function toStoredRow(row: SubscriptionDbRow): StoredSubscriptionRow {
  return {
    orgId: row.org_id,
    product: row.product,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeSubscriptionItemId: row.stripe_subscription_item_id,
    stripePriceId: row.stripe_price_id,
    status: row.status,
    trialing: row.trialing,
    trialEnd: date(row.trial_end),
    currentPeriodEnd: date(row.current_period_end),
    cancelAt: date(row.cancel_at),
    expired: row.expired,
    maxTeamSize: row.max_team_size,
    extraUsers: row.extra_users,
    usagePlanId: row.usage_plan_id,
    apiKeyId: row.api_key_id,
    createdAt: new Date(row.created_at),
    updatedFromStripeAt: date(row.updated_from_stripe_at),
  };
}

export const KEY_COLUMNS =
  "id, org_id, product, enabled, usage_plan_id, created_at, rotated_from, retire_at";

export type KeyDbRow = {
  id: string;
  org_id: string;
  product: "bank_checker" | "eiscd";
  enabled: boolean;
  usage_plan_id: string | null;
  created_at: string;
  rotated_from: string | null;
  retire_at: string | null;
  disabled_by_admin?: boolean;
};

export function toStoredKey(row: KeyDbRow): StoredKey {
  return {
    id: row.id,
    enabled: row.enabled,
    usagePlanId: row.usage_plan_id,
    disabledByAdmin: row.disabled_by_admin ?? false,
  };
}
