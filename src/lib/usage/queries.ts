import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { utcDate } from "./sync";
import { addBlankDates, projectedMonthlyUsage, type UsagePoint } from "./series";

// Reading usage_daily (plan §6.4, Q3). The page reads as the signed-in user,
// so RLS limits it to their organisation's keys (MON-06). Every key the
// organisation has had for the product counts, so usage during a rotation
// overlap is complete (KEY-01).

type Product = "bank_checker" | "eiscd";

type Row = { date: string; success: number; not_found: number; synced_at: string };

/** Two years: the longest range on the chart (MON-02). */
const HISTORY_DAYS = 730;
/** PostgREST returns at most this many rows per request by default. */
const PAGE = 1000;

async function readRows(
  db: SupabaseClient,
  orgId: string,
  product: Product,
  sinceDays: number,
): Promise<Row[]> {
  const from = utcDate(new Date(), sinceDays);
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db
      .from("usage_daily")
      .select("date, success, not_found, synced_at, api_keys!inner (org_id, product)")
      .eq("api_keys.org_id", orgId)
      .eq("api_keys.product", product)
      .gte("date", from)
      .order("date")
      .order("api_key_id")
      .range(offset, offset + PAGE - 1)
      .returns<Row[]>();
    if (error) throw new Error(`reading usage failed: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

export type OrgUsage = {
  points: UsagePoint[];
  /** When the nightly job last wrote any of these rows. */
  lastSyncedAt: Date | null;
};

/** Daily usage for the chart: two years, zero days filled in (MON-01, MON-05). */
export async function getOrgUsage(orgId: string, product: Product): Promise<OrgUsage> {
  const rows = await readRows(await createClient(), orgId, product, HISTORY_DAYS);
  const lastSynced = rows.reduce<string | null>(
    (latest, row) => (!latest || row.synced_at > latest ? row.synced_at : latest),
    null,
  );
  return {
    points: addBlankDates(
      rows.map((row) => ({ date: row.date, success: row.success, notFound: row.not_found })),
    ),
    lastSyncedAt: lastSynced ? new Date(lastSynced) : null,
  };
}

/**
 * Checks a month at the recent rate, for plan recommendations and overage
 * warnings (PLAN-06, PLAN-07). Null when there's no usage yet. Server-side
 * (service role): callers have already checked who is asking.
 */
export async function projectedMonthlyChecks(orgId: string): Promise<number | null> {
  const rows = await readRows(createServiceClient(), orgId, "bank_checker", 32);
  if (rows.length === 0) return null;
  return projectedMonthlyUsage(
    addBlankDates(
      rows.map((row) => ({ date: row.date, success: row.success, notFound: row.not_found })),
    ),
  );
}
