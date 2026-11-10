import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { OrgRole, ReviewStatus } from "@/lib/nav";

// Key rotation (KEY-01, plan §6.13). Owners and developers replace the
// organisation's key, now or with a 24-hour overlap. The new key goes in
// the same usage plan; record_key_rotation() switches the subscription to
// it and audits the change in one transaction; the owner is always
// emailed. The Tools proxy reads the subscription's key, so it switches at
// once.

export const ROTATION_OVERLAP_HOURS = 24;

export type RotateKeyDeps = {
  db: SupabaseClient;
  keys: {
    createKey(input: {
      name: string;
      usagePlanId: string;
      tags: Record<string, string>;
    }): Promise<{ id: string }>;
    disableKey(keyId: string, usagePlanId: string | null): Promise<void>;
  };
  lock: { tryLock(key: string): Promise<boolean>; releaseLock(key: string): Promise<void> };
  notifyOwner(input: {
    orgId: string;
    orgName: string;
    rotatedBy: string;
    oldKeyUntil: Date | null;
  }): Promise<void>;
  keyTags: Record<string, string>;
  now?: () => Date;
};

export type RotateResult = { ok: true; message: string } | { ok: false; error: string };

type Who = {
  id: string;
  email: string;
  /** "admin": a Mintly admin rotating from the admin area (plan §6.8). */
  role: OrgRole | "admin";
  orgId: string;
  orgName: string;
  reviewStatus: ReviewStatus;
};

/**
 * Whether this person may rotate the key (plan §3: owners and developers of
 * approved organisations, and Mintly admins for any organisation).
 */
export function canRotateKey(who: Pick<Who, "role" | "reviewStatus"> | null): boolean {
  if (who?.role === "admin") return true;
  return Boolean(who && who.role !== "member" && who.reviewStatus === "approved");
}

export async function rotateKey(
  deps: RotateKeyDeps,
  who: Who,
  when: "now" | "overlap",
): Promise<RotateResult> {
  if (!canRotateKey(who)) return { ok: false, error: "You can't rotate the API key." };

  const { data: sub, error } = await deps.db
    .from("subscriptions")
    .select(
      "stripe_subscription_id, stripe_subscription_item_id, api_key_id, api_keys (enabled, usage_plan_id, retire_at)",
    )
    .eq("org_id", who.orgId)
    .eq("product", "bank_checker")
    .eq("expired", false)
    .maybeSingle<{
      stripe_subscription_id: string;
      stripe_subscription_item_id: string | null;
      api_key_id: string | null;
      api_keys: { enabled: boolean; usage_plan_id: string | null; retire_at: string | null } | null;
    }>();
  if (error) throw new Error(`reading the subscription failed: ${error.message}`);
  const oldKeyId = sub?.api_key_id;
  const key = sub?.api_keys;
  if (!sub || !oldKeyId || !key?.enabled || !key.usage_plan_id) {
    return { ok: false, error: "Your subscription has no active key to rotate." };
  }

  // Never alongside a webhook changing the same subscription's key.
  const lock = `subscription:${sub.stripe_subscription_id}`;
  if (!(await deps.lock.tryLock(lock))) {
    return { ok: false, error: "Your subscription is being updated. Try again in a minute." };
  }
  const now = deps.now?.() ?? new Date();
  const retireAt =
    when === "now" ? now : new Date(now.getTime() + ROTATION_OVERLAP_HOURS * 60 * 60 * 1000);
  try {
    const created = await deps.keys.createKey({
      name: `v2-${sub.stripe_subscription_item_id ?? sub.stripe_subscription_id}-r${Math.floor(now.getTime() / 1000)}`,
      usagePlanId: key.usage_plan_id,
      tags: deps.keyTags,
    });
    const { error: rpcError } = await deps.db.rpc("record_key_rotation", {
      p_old_key_id: oldKeyId,
      p_new_key_id: created.id,
      p_retire_at: retireAt.toISOString(),
      p_actor_id: who.id,
      p_details: { when, by_role: who.role },
    });
    if (rpcError) {
      // The new key exists but isn't used; turn it off so it can't leak.
      await deps.keys.disableKey(created.id, key.usage_plan_id).catch(() => undefined);
      if (rpcError.code === "P0001")
        return { ok: false, error: "Your key is already being replaced." };
      throw new Error(`recording the rotation failed: ${rpcError.message}`);
    }
  } finally {
    await deps.lock.releaseLock(lock);
  }

  if (when === "now") {
    // If this fails, the hourly job retires the key instead.
    await retireDueKeys(deps, now).catch((e) => console.error("retiring the old key failed", e));
  }

  try {
    await deps.notifyOwner({
      orgId: who.orgId,
      orgName: who.orgName,
      rotatedBy: who.role === "admin" ? "Mintly support" : who.email,
      oldKeyUntil: when === "now" ? null : retireAt,
    });
  } catch (e) {
    console.error("key rotation email failed", e);
  }

  return {
    ok: true,
    message:
      when === "now"
        ? "Your key has been replaced. The previous key no longer works."
        : `Your key has been replaced. The previous key keeps working for ${ROTATION_OVERLAP_HOURS} hours.`,
  };
}

/** Turns off keys whose overlap has ended (KEY-01). Run hourly and after a rotation. */
export async function retireDueKeys(
  deps: Pick<RotateKeyDeps, "db" | "keys">,
  now: Date,
): Promise<{ retired: string[]; errors: string[] }> {
  const { data, error } = await deps.db
    .from("api_keys")
    .select("id, usage_plan_id")
    .eq("enabled", true)
    .lte("retire_at", now.toISOString())
    .returns<Array<{ id: string; usage_plan_id: string | null }>>();
  if (error) throw new Error(`reading keys to retire failed: ${error.message}`);

  const result = { retired: [] as string[], errors: [] as string[] };
  for (const key of data) {
    try {
      await deps.keys.disableKey(key.id, key.usage_plan_id);
      const { error: updateError } = await deps.db
        .from("api_keys")
        .update({ enabled: false, usage_plan_id: null })
        .eq("id", key.id);
      if (updateError) throw new Error(updateError.message);
      result.retired.push(key.id);
    } catch (e) {
      result.errors.push(`${key.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}
