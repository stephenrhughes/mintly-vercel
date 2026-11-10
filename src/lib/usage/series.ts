// The figures behind the usage chart (MON-01 to MON-04), ported from
// mintly-web src/components/monitoringLogic.js and the usage Lambda's
// addBlankDates, so the new charts match the old site. moment is replaced
// by plain UTC Date arithmetic.

/** One day (or month) of usage. `date` is an ISO timestamp at UTC midnight. */
export type UsagePoint = {
  date: string;
  success: number;
  notFound: number;
  quantity?: number;
};

/** Ranges longer than this are rolled up by month rather than shown by day. */
export const DAYS_IN_MONTH = 30;

/** The chart's period picker (MON-02), longest first as on the old site. */
export const DATE_RANGES = [
  { label: "2Y", days: 730, name: "Two years" },
  { label: "1Y", days: 365, name: "One year" },
  { label: "6M", days: 183, name: "6 months" },
  { label: "3M", days: 91, name: "3 months" },
  { label: "1M", days: 30, name: "1 month" },
  { label: "7D", days: 7, name: "7 days" },
] as const;

/** Estimated cost of fixing one failed BACS attempt (MON-03). */
export const COST_PER_FAILED_ACCOUNT_GBP = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Insert thousands separators: 1234567 -> "1,234,567". */
export const numberWithCommas = (x: number): string =>
  x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const toUtcMidnight = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

/**
 * Daily rows from usage_daily, with zero days added between the first and
 * last day so the chart has no gaps (MON-05), sorted by date.
 */
export function addBlankDates(
  rows: Array<{ date: string; success: number; notFound: number }>,
): UsagePoint[] {
  if (rows.length === 0) return [];
  const byDay = new Map<string, { success: number; notFound: number }>();
  for (const row of rows) {
    const day = row.date.slice(0, 10);
    const existing = byDay.get(day) ?? { success: 0, notFound: 0 };
    byDay.set(day, {
      success: existing.success + row.success,
      notFound: existing.notFound + row.notFound,
    });
  }
  const days = [...byDay.keys()].sort();
  const last = toUtcMidnight(days[days.length - 1]);
  const output: UsagePoint[] = [];
  for (let t = toUtcMidnight(days[0]); t <= last; t = new Date(t.getTime() + DAY_MS)) {
    const day = t.toISOString().slice(0, 10);
    const { success, notFound } = byDay.get(day) ?? { success: 0, notFound: 0 };
    output.push({ date: t.toISOString(), success, notFound, quantity: success + notFound });
  }
  return output;
}

/**
 * Keep only the points inside the trailing `dateRange` window.
 *
 * The window starts one extra day back, matching the chart's original
 * behaviour of showing a full `dateRange` days inclusive of today.
 */
export function filterByDateRange(
  usageData: UsagePoint[] | undefined,
  dateRange: number,
  now: Date | string = new Date(),
): UsagePoint[] {
  const start = new Date(now).getTime() - (dateRange + 1) * DAY_MS;
  return (usageData ?? []).filter((value) => start < new Date(value.date).getTime());
}

/** Roll daily points up into one point per calendar month. */
export function groupByMonth(data: UsagePoint[]): UsagePoint[] {
  return data.reduce<UsagePoint[]>((prev, element) => {
    const month = `${element.date.split("T")[0].slice(0, 7)}-01`;
    const existing = prev.find((f) => f.date === month);
    if (existing) {
      existing.success += element.success;
      existing.notFound += element.notFound;
    } else {
      prev.push({ date: month, success: element.success, notFound: element.notFound });
    }
    return prev;
  }, []);
}

export type ChartSeries = { interval: "day" | "mon"; data: UsagePoint[] };

/**
 * The series the chart renders, plus the interval it is bucketed at.
 * Ranges beyond a month are grouped monthly to keep the axis readable.
 */
export function buildChartSeries(
  usageData: UsagePoint[] | undefined,
  dateRange: number,
  now: Date | string = new Date(),
): ChartSeries {
  const filtered = filterByDateRange(usageData, dateRange, now);
  if (dateRange > DAYS_IN_MONTH) return { interval: "mon", data: groupByMonth(filtered) };
  return { interval: "day", data: filtered };
}

/** Projected requests per day, averaged over the trailing month (MON-04). */
export function predictedDailyUsage(
  usageData: UsagePoint[] | undefined,
  now: Date | string = new Date(),
): number {
  const filtered = filterByDateRange(usageData, DAYS_IN_MONTH, now);
  return filtered.reduce((total, current) => total + (current.quantity ?? 0), 0) / DAYS_IN_MONTH;
}

/** Requests projected for a month at the current rate. */
export function projectedMonthlyUsage(
  usageData: UsagePoint[] | undefined,
  now: Date | string = new Date(),
): number {
  return Math.round(predictedDailyUsage(usageData, now) * DAYS_IN_MONTH);
}

export type PeriodStatistics = {
  success: number;
  notFound: number;
  total: number;
  successPercent: number;
  notFoundPercent: number;
};

/**
 * Success and not-found totals for the visible period, with their shares
 * (MON-03). The percentages are 0 rather than NaN when there is no traffic.
 */
export function periodStatistics(
  usageData: UsagePoint[] | undefined,
  dateRange: number,
  now: Date | string = new Date(),
): PeriodStatistics {
  const filtered = filterByDateRange(usageData, dateRange, now);
  const success = filtered.reduce((total, cur) => total + (cur.success ?? 0), 0);
  const notFound = filtered.reduce((total, cur) => total + (cur.notFound ?? 0), 0);
  const total = success + notFound;
  return {
    success,
    notFound,
    total,
    successPercent: total === 0 ? 0 : Math.round((100 * success) / total),
    notFoundPercent: total === 0 ? 0 : Math.round((100 * notFound) / total),
  };
}

/** Estimated saving from catching bad accounts before a failed BACS attempt. */
export const estimatedSaving = (notFound: number) => notFound * COST_PER_FAILED_ACCOUNT_GBP;
