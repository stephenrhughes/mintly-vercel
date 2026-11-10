import "server-only";

import { readDailyStats } from "@/lib/aws/usageStats";
import { createServiceClient } from "@/lib/supabase/admin";

import type { SyncKey, UsageSyncDeps } from "./sync";

// Wires the usage sync to DynamoDB (through the AWS adapter) and Supabase
// (service role: usage_daily and check_log are written only by the server).

type KeyRow = { id: string; enabled: boolean; usage_backfilled_at: string | null };

export function usageSyncDeps(): UsageSyncDeps {
  const db = createServiceClient();
  return {
    async listKeys(changedSince) {
      const { data, error } = await db
        .from("api_keys")
        .select("id, enabled, usage_backfilled_at")
        .or(`enabled.eq.true,updated_at.gte.${changedSince.toISOString()}`)
        .returns<KeyRow[]>();
      if (error) throw new Error(error.message);
      return data.map((row): SyncKey => ({
        id: row.id,
        enabled: row.enabled,
        backfilledAt: row.usage_backfilled_at ? new Date(row.usage_backfilled_at) : null,
      }));
    },
    readDailyStats,
    async upsertUsage(rows) {
      const { error } = await db
        .from("usage_daily")
        .upsert(rows, { onConflict: "api_key_id,date" });
      if (error) throw new Error(error.message);
    },
    async markBackfilled(keyId, at) {
      // The updated_at trigger bumps the key too, so a disabled key is
      // synced for a few more nights; harmless, and it stops by itself.
      const { error } = await db
        .from("api_keys")
        .update({ usage_backfilled_at: at.toISOString() })
        .eq("id", keyId);
      if (error) throw new Error(error.message);
    },
    async purgeCheckLog(before) {
      const { error, count } = await db
        .from("check_log")
        .delete({ count: "exact" })
        .lt("at", before.toISOString());
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  };
}
