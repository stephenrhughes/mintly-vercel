import { describe, expect, it } from "vitest";

import {
  addBlankDates,
  buildChartSeries,
  COST_PER_FAILED_ACCOUNT_GBP,
  DAYS_IN_MONTH,
  estimatedSaving,
  filterByDateRange,
  groupByMonth,
  numberWithCommas,
  periodStatistics,
  predictedDailyUsage,
  projectedMonthlyUsage,
  type UsagePoint,
} from "./series";

// Ported from mintly-web src/components/__tests__/monitoringLogic.test.js,
// so the new charts give the same figures as the old monitor page.

// Fixed "now" so the trailing-window maths never depends on the clock.
const NOW = "2026-07-15T12:00:00.000Z";

const point = (date: string, success: number, notFound: number): UsagePoint => ({
  date: `${date}T00:00:00.000Z`,
  success,
  notFound,
  quantity: success + notFound,
});

describe("numberWithCommas", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [1000, "1,000"],
    [1234567, "1,234,567"],
    [1000000, "1,000,000"],
  ])("formats %i as %s", (input, expected) => {
    expect(numberWithCommas(input)).toBe(expected);
  });

  it("leaves a negative number's sign alone", () => {
    expect(numberWithCommas(-1234)).toBe("-1,234");
  });
});

describe("addBlankDates (from the usage Lambda's helpers.js)", () => {
  it("fills missing days with zeros between the first and last day (MON-05)", () => {
    expect(
      addBlankDates([
        { date: "2026-07-03", success: 2, notFound: 1 },
        { date: "2026-07-01", success: 5, notFound: 0 },
      ]),
    ).toEqual([point("2026-07-01", 5, 0), point("2026-07-02", 0, 0), point("2026-07-03", 2, 1)]);
  });

  it("adds up rows for the same day, such as two keys during a rotation (KEY-01)", () => {
    expect(
      addBlankDates([
        { date: "2026-07-01", success: 5, notFound: 1 },
        { date: "2026-07-01", success: 3, notFound: 2 },
      ]),
    ).toEqual([point("2026-07-01", 8, 3)]);
  });

  it("returns nothing for no rows (MON-07)", () => {
    expect(addBlankDates([])).toEqual([]);
  });

  it("crosses a month and a year end", () => {
    const days = addBlankDates([
      { date: "2026-12-30", success: 1, notFound: 0 },
      { date: "2027-01-02", success: 1, notFound: 0 },
    ]).map((d) => d.date.slice(0, 10));
    expect(days).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
});

describe("filterByDateRange", () => {
  const data = [point("2026-05-01", 1, 0), point("2026-07-01", 2, 0), point("2026-07-14", 3, 0)];

  it("keeps only points inside the trailing window", () => {
    const result = filterByDateRange(data, 7, NOW);
    expect(result.map((d) => d.date.slice(0, 10))).toEqual(["2026-07-14"]);
  });

  it("widens as the range grows", () => {
    expect(filterByDateRange(data, 30, NOW)).toHaveLength(2);
    expect(filterByDateRange(data, 365, NOW)).toHaveLength(3);
  });

  it("returns an empty array for no data", () => {
    expect(filterByDateRange([], 30, NOW)).toEqual([]);
  });

  it("tolerates undefined data rather than throwing", () => {
    expect(filterByDateRange(undefined, 30, NOW)).toEqual([]);
  });

  it("does not mutate its input", () => {
    const input = [...data];
    filterByDateRange(input, 7, NOW);
    expect(input).toHaveLength(3);
  });
});

describe("groupByMonth", () => {
  it("sums daily points into one point per calendar month", () => {
    const result = groupByMonth([
      point("2026-06-01", 10, 1),
      point("2026-06-15", 5, 2),
      point("2026-07-02", 7, 3),
    ]);
    expect(result).toEqual([
      { date: "2026-06-01", success: 15, notFound: 3 },
      { date: "2026-07-01", success: 7, notFound: 3 },
    ]);
  });

  it("normalises every bucket to the first of the month", () => {
    expect(groupByMonth([point("2026-06-28", 1, 0)])[0].date).toBe("2026-06-01");
  });

  it("keeps months in the order they first appear", () => {
    const result = groupByMonth([point("2026-07-01", 1, 0), point("2026-06-01", 1, 0)]);
    expect(result.map((d) => d.date)).toEqual(["2026-07-01", "2026-06-01"]);
  });

  it("spans a year boundary without merging", () => {
    const result = groupByMonth([point("2026-12-31", 1, 0), point("2027-01-01", 2, 0)]);
    expect(result.map((d) => d.date)).toEqual(["2026-12-01", "2027-01-01"]);
  });

  it("returns an empty array for no data", () => {
    expect(groupByMonth([])).toEqual([]);
  });

  it("preserves the overall totals", () => {
    const grouped = groupByMonth([
      point("2026-06-01", 10, 1),
      point("2026-06-15", 5, 2),
      point("2026-07-02", 7, 3),
    ]);
    expect(grouped.reduce((t, d) => t + d.success, 0)).toBe(22);
    expect(grouped.reduce((t, d) => t + d.notFound, 0)).toBe(6);
  });
});

describe("buildChartSeries", () => {
  const data = [point("2026-05-10", 1, 0), point("2026-06-10", 2, 0), point("2026-07-10", 3, 0)];

  it("keeps daily points for a range of a month or less", () => {
    const { interval, data: series } = buildChartSeries(data, 30, NOW);
    expect(interval).toBe("day");
    expect(series.map((d) => d.date.slice(0, 10))).toEqual(["2026-07-10"]);
  });

  it("groups by month once the range exceeds a month", () => {
    const { interval, data: series } = buildChartSeries(data, 90, NOW);
    expect(interval).toBe("mon");
    expect(series.map((d) => d.date)).toEqual(["2026-05-01", "2026-06-01", "2026-07-01"]);
  });

  it("switches at exactly 30 days, not before", () => {
    expect(buildChartSeries(data, DAYS_IN_MONTH, NOW).interval).toBe("day");
    expect(buildChartSeries(data, DAYS_IN_MONTH + 1, NOW).interval).toBe("mon");
  });

  it("returns an empty series for no data", () => {
    expect(buildChartSeries([], 30, NOW)).toEqual({ interval: "day", data: [] });
  });
});

describe("predictedDailyUsage", () => {
  it("averages the trailing month's volume over 30 days", () => {
    const data = [point("2026-07-01", 50, 10), point("2026-07-10", 40, 20)];
    // (60 + 60) / 30
    expect(predictedDailyUsage(data, NOW)).toBe(4);
    expect(projectedMonthlyUsage(data, NOW)).toBe(120);
  });

  it("ignores traffic older than a month", () => {
    const data = [point("2026-01-01", 3000, 0), point("2026-07-10", 30, 0)];
    expect(predictedDailyUsage(data, NOW)).toBe(1);
  });

  it("is zero with no usage", () => {
    expect(predictedDailyUsage([], NOW)).toBe(0);
  });

  it("does not produce NaN when quantity is missing", () => {
    const data = [{ date: "2026-07-10T00:00:00.000Z", success: 1, notFound: 0 }];
    expect(predictedDailyUsage(data, NOW)).toBe(0);
  });
});

describe("periodStatistics", () => {
  it("totals success and not-found over the window", () => {
    const data = [point("2026-07-10", 75, 25), point("2026-07-12", 25, 75)];
    expect(periodStatistics(data, 30, NOW)).toMatchObject({
      success: 100,
      notFound: 100,
      total: 200,
      successPercent: 50,
      notFoundPercent: 50,
    });
  });

  it("rounds percentages", () => {
    expect(periodStatistics([point("2026-07-10", 1, 2)], 30, NOW)).toMatchObject({
      successPercent: 33,
      notFoundPercent: 67,
    });
  });

  it("reports zero percent rather than NaN when there is no traffic", () => {
    const stats = periodStatistics([], 30, NOW);
    expect(stats).toMatchObject({ success: 0, notFound: 0, successPercent: 0, notFoundPercent: 0 });
  });

  it("reports zero percent for days that are all zero", () => {
    const stats = periodStatistics([point("2026-07-10", 0, 0)], 30, NOW);
    expect(stats.successPercent).toBe(0);
    expect(stats.notFoundPercent).toBe(0);
  });

  it("handles an all-success period", () => {
    const stats = periodStatistics([point("2026-07-10", 10, 0)], 30, NOW);
    expect(stats.successPercent).toBe(100);
    expect(stats.notFoundPercent).toBe(0);
  });

  it("respects the selected range", () => {
    const data = [point("2026-06-01", 100, 0), point("2026-07-14", 5, 0)];
    expect(periodStatistics(data, 7, NOW).success).toBe(5);
    expect(periodStatistics(data, 90, NOW).success).toBe(105);
  });
});

describe("estimatedSaving", () => {
  it("values each caught bad account at the BACS remediation cost", () => {
    expect(estimatedSaving(10)).toBe(10 * COST_PER_FAILED_ACCOUNT_GBP);
  });

  it("is zero when nothing was caught", () => {
    expect(estimatedSaving(0)).toBe(0);
  });
});
