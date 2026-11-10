"use client";

import { PoundSterling } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { Button } from "@/components/ui/button";
import {
  buildChartSeries,
  DATE_RANGES,
  DAYS_IN_MONTH,
  estimatedSaving,
  numberWithCommas,
  periodStatistics,
  predictedDailyUsage,
  type UsagePoint,
} from "@/lib/usage/series";

// The usage chart (MON-01 to MON-04, MON-07): daily valid and invalid
// checks as stacked bars, grouped by month beyond 30 days, with the period's
// totals, estimated saving and a projection. It takes plain points, so the
// admin organisation page can reuse it (ADM-04, phase 5).

const VALID = "var(--chart-valid)";
const INVALID = "var(--chart-invalid)";

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const monthLabel = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

type Datum = { label: string; success: number; notFound: number };

function Swatch({ color }: { color: string }) {
  return <span className="inline-block size-3 shrink-0 rounded-sm" style={{ background: color }} />;
}

function ChartTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload as Datum;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{datum.label}</p>
      <p className="flex items-center gap-2">
        <Swatch color={VALID} /> Valid{" "}
        <span className="ml-auto tabular-nums">{numberWithCommas(datum.success)}</span>
      </p>
      <p className="flex items-center gap-2">
        <Swatch color={INVALID} /> Invalid{" "}
        <span className="ml-auto pl-4 tabular-nums">{numberWithCommas(datum.notFound)}</span>
      </p>
    </div>
  );
}

export function UsageChart({ points, now }: { points: UsagePoint[]; now: string }) {
  const [range, setRange] = useState<number>(DAYS_IN_MONTH);
  const series = useMemo(() => buildChartSeries(points, range, now), [points, range, now]);
  const stats = useMemo(() => periodStatistics(points, range, now), [points, range, now]);
  const projected = useMemo(
    () => Math.round(predictedDailyUsage(points, now) * DAYS_IN_MONTH),
    [points, now],
  );
  const data: Datum[] = series.data.map((point) => ({
    label: series.interval === "day" ? dayLabel(point.date) : monthLabel(point.date),
    success: point.success,
    notFound: point.notFound,
  }));

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No usage data to display yet.</p>;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm" aria-label="Legend">
          <span className="flex items-center gap-2">
            <Swatch color={VALID} /> Valid
          </span>
          <span className="flex items-center gap-2">
            <Swatch color={INVALID} /> Invalid
          </span>
        </div>
        <div role="group" aria-label="Date range" className="inline-flex rounded-md border">
          {DATE_RANGES.map(({ label, days, name }) => (
            <Button
              key={days}
              type="button"
              size="sm"
              variant={range === days ? "default" : "ghost"}
              className="rounded-none first:rounded-l-md last:rounded-r-md"
              aria-pressed={range === days}
              aria-label={name}
              onClick={() => setRange(days)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(value: number) => numberWithCommas(value)}
            />
            <Tooltip
              content={ChartTooltip}
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              isAnimationActive={false}
            />
            <Bar
              dataKey="success"
              name="Valid"
              stackId="usage"
              fill={VALID}
              stroke="var(--card)"
              strokeWidth={1}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Bar
              dataKey="notFound"
              name="Invalid"
              stackId="usage"
              fill={INVALID}
              stroke="var(--card)"
              strokeWidth={1}
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground">
            <Swatch color={VALID} /> Valid in this period
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {numberWithCommas(stats.success)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({stats.successPercent}%)
            </span>
          </dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground">
            <Swatch color={INVALID} /> Invalid in this period
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {numberWithCommas(stats.notFound)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({stats.notFoundPercent}%)
            </span>
          </dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground">
            <PoundSterling className="size-3" aria-hidden /> Estimated saving*
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            £{numberWithCommas(estimatedSaving(stats.notFound))}
          </dd>
        </div>
      </dl>

      <p className="text-sm">
        Based on average usage you will use{" "}
        <strong className="tabular-nums">{numberWithCommas(projected)}</strong> requests this month.
      </p>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-primary">Show as a table</summary>
        <div className="mt-2 max-h-80 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Valid and invalid checks by {series.interval === "day" ? "day" : "month"}
            </caption>
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left">
                <th scope="col" className="px-3 py-2 font-medium">
                  {series.interval === "day" ? "Day" : "Month"}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Valid
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Invalid
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((datum) => (
                <tr key={datum.label} className="border-t">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    {datum.label}
                  </th>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {numberWithCommas(datum.success)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {numberWithCommas(datum.notFound)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="grid gap-2 text-xs text-muted-foreground">
        <p>
          * Savings are based on the total cost of fixing wrong bank account details after a failed
          BACS payment. BACS research puts this at £50 per failed account on average, including fees
          and the time to put the data right. Savings for individual organisations will vary.
        </p>
        <p>
          Billing periods follow your monthly renewal date, while the chart groups longer ranges by
          calendar month.
        </p>
      </div>
    </div>
  );
}
