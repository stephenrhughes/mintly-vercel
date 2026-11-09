// The nightly usage sync (plan §6.4, Q3): copies each key's daily usage from
// DynamoDB ApiDailyUsageStats into usage_daily, which the charts read.
// Pure apart from the injected deps, so it is unit-tested without AWS or
// Supabase. Wired up in sync-server.ts and run by /api/cron/usage-sync.

import type { DailyStat } from "@/lib/aws/types";

/** Days re-read every night, to pick up late writes (plan §6.4). */
export const RECENT_DAYS = 3;
/** History read the first time a key is synced (plan §6.4: 2 years). */
export const BACKFILL_DAYS = 730;
/**
 * Keys changed this recently are synced even if now disabled, so the last
 * days of a key that was just turned off or retired after a rotation
 * overlap (KEY-01) are still counted.
 */
export const RECENTLY_CHANGED_DAYS = RECENT_DAYS + 1;
/** check_log rows older than this are deleted (plan §13.4: 13 months). */
export const CHECK_LOG_RETENTION_MONTHS = 13;

const CONCURRENCY = 5;
const UPSERT_CHUNK = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SyncKey = { id: string; enabled: boolean; backfilledAt: Date | null };

export type UsageRow = {
  api_key_id: string;
  date: string;
  success: number;
  not_found: number;
  synced_at: string;
};

export type UsageSyncDeps = {
  /** Enabled keys, and keys updated since `changedSince`. */
  listKeys(changedSince: Date): Promise<SyncKey[]>;
  readDailyStats(keyId: string, from: string, to: string): Promise<DailyStat[]>;
  upsertUsage(rows: UsageRow[]): Promise<void>;
  markBackfilled(keyId: string, at: Date): Promise<void>;
  /** Deletes check_log rows before the date; returns how many. */
  purgeCheckLog(before: Date): Promise<number>;
  now?: () => Date;
};

export type UsageSyncResult = {
  keys: number;
  enabledKeys: number;
  backfilled: number;
  rows: number;
  purgedChecks: number;
  errors: string[];
};

/** A UTC date as YYYY-MM-DD, `daysAgo` days before `now`. */
export function utcDate(now: Date, daysAgo = 0): string {
  return new Date(now.getTime() - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

/** The window to read for a key: the last few days, or two years the first time. */
export function syncWindow(key: SyncKey, now: Date): { from: string; to: string } {
  const days = key.backfilledAt ? RECENT_DAYS - 1 : BACKFILL_DAYS;
  return { from: utcDate(now, days), to: utcDate(now) };
}

export function retentionCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - CHECK_LOG_RETENTION_MONTHS);
  return cutoff;
}

async function inBatches<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(task));
  }
}

export async function runUsageSync(deps: UsageSyncDeps): Promise<UsageSyncResult> {
  const now = deps.now?.() ?? new Date();
  const syncedAt = now.toISOString();
  const result: UsageSyncResult = {
    keys: 0,
    enabledKeys: 0,
    backfilled: 0,
    rows: 0,
    purgedChecks: 0,
    errors: [],
  };

  let keys: SyncKey[] = [];
  try {
    keys = await deps.listKeys(new Date(now.getTime() - RECENTLY_CHANGED_DAYS * DAY_MS));
  } catch (error) {
    result.errors.push(`listing keys: ${message(error)}`);
  }
  result.keys = keys.length;
  result.enabledKeys = keys.filter((key) => key.enabled).length;

  await inBatches(keys, CONCURRENCY, async (key) => {
    try {
      const { from, to } = syncWindow(key, now);
      const stats = await deps.readDailyStats(key.id, from, to);
      const rows = stats.map((stat) => ({
        api_key_id: key.id,
        date: stat.date,
        success: stat.success,
        not_found: stat.notFound,
        synced_at: syncedAt,
      }));
      for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
        await deps.upsertUsage(rows.slice(i, i + UPSERT_CHUNK));
      }
      result.rows += rows.length;
      if (!key.backfilledAt) {
        await deps.markBackfilled(key.id, now);
        result.backfilled += 1;
      }
    } catch (error) {
      result.errors.push(`key ${key.id}: ${message(error)}`);
    }
  });

  try {
    result.purgedChecks = await deps.purgeCheckLog(retentionCutoff(now));
  } catch (error) {
    result.errors.push(`purging the check log: ${message(error)}`);
  }

  return result;
}

/**
 * Why admins should be told about this run, if they should (plan §9: alert
 * when a cron job fails or the usage sync finds no data). Finding no data
 * only counts on production: staging's test keys are often idle for days.
 */
export function alertReason(result: UsageSyncResult, production: boolean): string | null {
  if (result.errors.length > 0) {
    return `${result.errors.length} error${result.errors.length === 1 ? "" : "s"} during the usage sync`;
  }
  if (production && result.enabledKeys > 0 && result.rows === 0) {
    return `The usage sync found no usage for any of ${result.enabledKeys} enabled keys`;
  }
  return null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
