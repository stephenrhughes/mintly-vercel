import { describe, expect, it } from "vitest";

import { fakeDailyStats } from "./fake";
import { getUsageStatsTable, toDailyStat } from "./usageStats";

describe("toDailyStat", () => {
  it("reads an ApiDailyUsageStats item (MON-05)", () => {
    expect(toDailyStat({ ApiKey: "k", Date: "2026-11-01", Success: 12, NotFound: 3 })).toEqual({
      date: "2026-11-01",
      success: 12,
      notFound: 3,
    });
  });

  it("treats missing or odd counts as zero", () => {
    expect(toDailyStat({ Date: "2026-11-01", Success: "7" })).toEqual({
      date: "2026-11-01",
      success: 7,
      notFound: 0,
    });
    expect(toDailyStat({ Date: "2026-11-01", Success: -2, NotFound: "x" })).toMatchObject({
      success: 0,
      notFound: 0,
    });
  });

  it("skips items without a date", () => {
    expect(toDailyStat({ Success: 1 })).toBeNull();
  });
});

describe("getUsageStatsTable", () => {
  it("defaults to ApiDailyUsageStats", () => {
    expect(getUsageStatsTable({})).toBe("ApiDailyUsageStats");
    expect(getUsageStatsTable({ USAGE_STATS_TABLE: "Other" })).toBe("Other");
  });
});

describe("fakeDailyStats", () => {
  const today = new Date("2026-11-09T12:00:00Z");

  it("is the same every time for the same key", () => {
    expect(fakeDailyStats("k1", "2026-10-01", "2026-11-09", today)).toEqual(
      fakeDailyStats("k1", "2026-10-01", "2026-11-09", today),
    );
  });

  it("stays inside the window and never goes past today", () => {
    const stats = fakeDailyStats("k1", "2026-11-01", "2026-12-31", today);
    expect(stats.length).toBeGreaterThan(0);
    for (const stat of stats) {
      expect(stat.date >= "2026-11-01" && stat.date <= "2026-11-09").toBe(true);
    }
  });
});
