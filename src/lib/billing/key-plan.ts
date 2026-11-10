// What should happen to an organisation's API key after a Stripe event:
// the provisioning rules PROV-01, PROV-04, PROV-05 and PROV-07 as a pure
// function. provision.ts carries out the actions through the AWS adapter.

import type { ReviewStatus } from "@/lib/nav";

import { isLiveStatus, type SubscriptionRecord } from "./subscription-record";

/** The key's state as recorded in api_keys. */
export type KeyState = {
  id: string;
  enabled: boolean;
  usagePlanId: string | null;
  /** An admin switched the key off; it stays off until they switch it on (plan §6.8). */
  disabledByAdmin?: boolean;
};

export type KeyAction =
  /** Create a key in this usage plan (PROV-01). */
  | { type: "create"; usagePlanId: string }
  /** Turn a disabled key back on and put it in this usage plan. */
  | { type: "enable"; keyId: string; usagePlanId: string }
  /** Move the key between usage plans (PROV-04, PROV-05). */
  | { type: "move"; keyId: string; from: string | null; to: string }
  /** Turn the key off and take it out of its usage plan (PROV-07, APPR-08). */
  | { type: "disable"; keyId: string; usagePlanId: string | null };

export function planKeyActions({
  record,
  reviewStatus,
  key,
}: {
  record: SubscriptionRecord;
  reviewStatus: ReviewStatus;
  key: KeyState | null;
}): KeyAction[] {
  const disable = (k: KeyState): KeyAction[] =>
    k.enabled || k.usagePlanId
      ? [{ type: "disable", keyId: k.id, usagePlanId: k.usagePlanId }]
      : [];

  if (record.expired) {
    // A subscription replaced by an upgrade or an accepted offer ended on
    // purpose; the replacement owns the organisation's access now (PROV-07).
    if (record.replacedByUpgrade || !key) return [];
    return disable(key);
  }

  // Not live yet (for example incomplete): wait for the next event.
  if (!isLiveStatus(record.status)) return [];

  switch (reviewStatus) {
    case "pending_review":
      // No production key until an admin approves the organisation (APPR-01).
      return [];
    case "rejected":
    case "suspended":
      return key ? disable(key) : [];
    case "approved":
      break;
  }

  // An admin's switch-off wins over the subscription (plan §6.8).
  if (key?.disabledByAdmin) return disable(key);

  const target = record.usagePlanId;
  if (!target) return []; // provision.ts refuses these first (PROV-10).

  if (!key) return [{ type: "create", usagePlanId: target }];
  if (!key.enabled) return [{ type: "enable", keyId: key.id, usagePlanId: target }];
  if (key.usagePlanId !== target) {
    return [{ type: "move", keyId: key.id, from: key.usagePlanId, to: target }];
  }
  return [];
}
