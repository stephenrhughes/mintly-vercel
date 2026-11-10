// API key operations for admins (plan §6.8): switch a key off on purpose,
// and back on. A key an admin switched off stays off through Stripe events
// and resyncs (api_keys.disabled_by_admin) until an admin switches it on;
// switching on hands the key back to the normal provisioning rules, which
// enable it only while the subscription is live and the organisation
// approved. Rotation reuses the customers' own rotateKey (KEY-01).

import { type AuditSink, errorText } from "./audit";

export type AdminKey = {
  id: string;
  orgId: string;
  enabled: boolean;
  usagePlanId: string | null;
  disabledByAdmin: boolean;
  /** The live subscription that uses this key, if any. */
  subscriptionId: string | null;
};

export type AdminKeyDeps = {
  getKey(keyId: string): Promise<AdminKey | null>;
  /** Turns the key off in API Gateway and takes it out of every usage plan. */
  switchOffInAws(keyId: string): Promise<void>;
  saveKey(
    keyId: string,
    state: { enabled: boolean; usagePlanId: string | null; disabledByAdmin: boolean },
  ): Promise<void>;
  syncSubscription(subscriptionId: string): Promise<void>;
  audit: AuditSink;
};

export type KeyResult =
  { ok: true; message: string; warnings: string[] } | { ok: false; error: string };

export async function switchKeyOff(
  deps: AdminKeyDeps,
  input: { orgId: string; keyId: string; actorId: string; reason: string },
): Promise<KeyResult> {
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "Say why the key is being switched off." };
  const key = await deps.getKey(input.keyId);
  if (!key || key.orgId !== input.orgId) return { ok: false, error: "Key not found." };
  if (key.disabledByAdmin)
    return { ok: false, error: "An admin has already switched this key off." };

  const before = { enabled: key.enabled, usage_plan_id: key.usagePlanId, disabled_by_admin: false };
  try {
    await deps.switchOffInAws(key.id);
    await deps.saveKey(key.id, { enabled: false, usagePlanId: null, disabledByAdmin: true });
  } catch (error) {
    await deps.audit({
      actorId: input.actorId,
      orgId: input.orgId,
      action: "key.failed",
      before,
      details: { api_key_id: key.id, change: "disable", reason, error: errorText(error) },
    });
    return { ok: false, error: `Switching the key off failed: ${errorText(error)}` };
  }
  await deps.audit({
    actorId: input.actorId,
    orgId: input.orgId,
    action: "key.disable",
    before,
    after: { enabled: false, usage_plan_id: null, disabled_by_admin: true },
    details: { api_key_id: key.id, reason },
  });
  return {
    ok: true,
    message: "The key is off. It stays off, whatever Stripe says, until an admin switches it on.",
    warnings: [],
  };
}

export async function switchKeyOn(
  deps: AdminKeyDeps,
  input: { orgId: string; keyId: string; actorId: string },
): Promise<KeyResult> {
  const key = await deps.getKey(input.keyId);
  if (!key || key.orgId !== input.orgId) return { ok: false, error: "Key not found." };
  if (!key.disabledByAdmin) return { ok: false, error: "No admin has switched this key off." };

  try {
    await deps.saveKey(key.id, {
      enabled: key.enabled,
      usagePlanId: key.usagePlanId,
      disabledByAdmin: false,
    });
  } catch (error) {
    await deps.audit({
      actorId: input.actorId,
      orgId: input.orgId,
      action: "key.failed",
      details: { api_key_id: key.id, change: "enable", error: errorText(error) },
    });
    return { ok: false, error: `Switching the key on failed: ${errorText(error)}` };
  }
  await deps.audit({
    actorId: input.actorId,
    orgId: input.orgId,
    action: "key.enable",
    before: { disabled_by_admin: true },
    after: { disabled_by_admin: false },
    details: { api_key_id: key.id },
  });

  const warnings: string[] = [];
  if (!key.subscriptionId) {
    return {
      ok: true,
      message:
        "The admin switch-off is cleared. The key stays off because no live subscription uses it.",
      warnings,
    };
  }
  try {
    await deps.syncSubscription(key.subscriptionId);
  } catch (error) {
    console.error("syncing after switching a key on failed", error);
    warnings.push("The key will come back on with the next Stripe event, or resync now.");
  }
  return {
    ok: true,
    message: "The key is back under the subscription's rules: on while it's live and approved.",
    warnings,
  };
}
