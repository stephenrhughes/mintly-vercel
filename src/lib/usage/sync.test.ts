import { describe, expect, it } from "vitest";

import {
  alertReason,
  BACKFILL_DAYS,
  retentionCutoff,
  runUsageSync,
  type SyncKey,
  syncWindow,
  type UsageRow,
  type UsageSyncDeps,
  type UsageSyncResult,
} from "./sync";

const now = new Date("2026-11-09T03:00:00Z");

function fakeDeps(keys: SyncKey[], overrides: Partial<UsageSyncDeps> = {}) {
  const calls = {
    reads: [] as Array<{ keyId: string; from: string; to: string }>,
    upserts: [] as UsageRow[][],
    backfilled: [] as string[],
    purgedBefore: [] as Date[],
    changedSince: [] as Date[],
  };
  const deps: UsageSyncDeps = {
    async listKeys(since) {
      calls.changedSince.push(since);
      return keys;
    },
    async readDailyStats(keyId, from, to) {
      calls.reads.push({ keyId, from, to });
      return [
        { date: "2026-11-08", success: 10, notFound: 2 },
        { date: "2026-11-09", success: 3, notFound: 0 },
      ];
    },
    async upsertUsage(rows) {
      calls.upserts.push(rows);
    },
    async markBackfilled(keyId) {
      calls.backfilled.push(keyId);
    },
    async purgeCheckLog(before) {
      calls.purgedBefore.push(before);
      return 4;
    },
    now: () => now,
    ...overrides,
  };
  return { deps, calls };
}

describe("syncWindow (plan §6.4)", () => {
  it("re-reads the last 3 days, today included, for a key already backfilled", () => {
    expect(syncWindow({ id: "k", enabled: true, backfilledAt: now }, now)).toEqual({
      from: "2026-11-07",
      to: "2026-11-09",
    });
  });

  it("reads two years for a key seen for the first time", () => {
    const { from, to } = syncWindow({ id: "k", enabled: true, backfilledAt: null }, now);
    expect(to).toBe("2026-11-09");
    expect((Date.parse(to) - Date.parse(from)) / 86_400_000).toBe(BACKFILL_DAYS);
  });
});

describe("runUsageSync", () => {
  it("upserts each key's days and marks new keys as backfilled", async () => {
    const { deps, calls } = fakeDeps([
      { id: "key_old", enabled: true, backfilledAt: new Date("2026-10-01") },
      { id: "key_new", enabled: true, backfilledAt: null },
      { id: "key_retired", enabled: false, backfilledAt: new Date("2026-10-01") },
    ]);
    const result = await runUsageSync(deps);

    expect(result).toMatchObject({ keys: 3, enabledKeys: 2, backfilled: 1, rows: 6, errors: [] });
    expect(calls.backfilled).toEqual(["key_new"]);
    expect(calls.upserts.flat()).toContainEqual({
      api_key_id: "key_old",
      date: "2026-11-08",
      success: 10,
      not_found: 2,
      synced_at: now.toISOString(),
    });
    // Keys changed in the last 4 days are included even if disabled (KEY-01).
    expect(calls.changedSince[0].toISOString()).toBe("2026-11-05T03:00:00.000Z");
  });

  it("keeps going when one key fails, and reports it", async () => {
    const { deps, calls } = fakeDeps(
      [
        { id: "key_bad", enabled: true, backfilledAt: null },
        { id: "key_good", enabled: true, backfilledAt: now },
      ],
      {
        async readDailyStats(keyId) {
          if (keyId === "key_bad") throw new Error("throttled");
          return [{ date: "2026-11-09", success: 1, notFound: 1 }];
        },
      },
    );
    const result = await runUsageSync(deps);
    expect(result.errors).toEqual(["key key_bad: throttled"]);
    expect(result.rows).toBe(1);
    // A failed backfill is retried next night.
    expect(calls.backfilled).toEqual([]);
  });

  it("writes nothing for a key with no usage", async () => {
    const { deps, calls } = fakeDeps([{ id: "k", enabled: true, backfilledAt: now }], {
      async readDailyStats() {
        return [];
      },
    });
    const result = await runUsageSync(deps);
    expect(result.rows).toBe(0);
    expect(calls.upserts).toEqual([]);
  });

  it("deletes check log rows older than 13 months (plan §13.4)", async () => {
    const { deps, calls } = fakeDeps([]);
    const result = await runUsageSync(deps);
    expect(result.purgedChecks).toBe(4);
    expect(calls.purgedBefore[0].toISOString()).toBe("2025-10-09T03:00:00.000Z");
    expect(retentionCutoff(now)).toEqual(calls.purgedBefore[0]);
  });
});

describe("alertReason (plan §9)", () => {
  const ok: UsageSyncResult = {
    keys: 2,
    enabledKeys: 2,
    backfilled: 0,
    rows: 10,
    purgedChecks: 0,
    errors: [],
  };

  it("says nothing when the run went well", () => {
    expect(alertReason(ok, true)).toBeNull();
  });

  it("alerts on any error", () => {
    expect(alertReason({ ...ok, errors: ["key k: boom"] }, false)).toBe(
      "1 error during the usage sync",
    );
  });

  it("alerts when production finds no usage at all", () => {
    expect(alertReason({ ...ok, rows: 0 }, true)).toMatch(/found no usage/);
    expect(alertReason({ ...ok, rows: 0 }, false)).toBeNull();
    expect(alertReason({ ...ok, rows: 0, enabledKeys: 0 }, true)).toBeNull();
  });
});
