import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTable, Td, Tr } from "@/components/admin/ui";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cancellationReasons,
  lastMonths,
  monthLabel,
  monthlyRows,
  revenueByPlan,
  trialConversion,
} from "@/lib/admin/reports";
import { loadReportData, loadRevenueLines } from "@/lib/admin/reports-server";
import { requireAdmin } from "@/lib/auth/session";
import { money } from "@/lib/billing/format";
import { dateTime } from "@/components/admin/shared";

export const metadata: Metadata = { title: "Reports" };

const title = "Reports";
const MONTHS = 6;

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Reports />
    </Suspense>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-background p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </div>
  );
}

const hours = (h: number | null) =>
  h === null ? "—" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`;

// The business dashboard (ADM-14).
async function Reports() {
  await requireAdmin("/admin/reports");
  const now = new Date();
  const months = lastMonths(now, MONTHS);
  const since = new Date(`${months[0]}-01T00:00:00Z`);
  const [data, revenue] = await Promise.all([
    loadReportData(since),
    loadRevenueLines().catch((error) => {
      console.error("reading revenue from Stripe failed", error);
      return null;
    }),
  ]);
  const rows = monthlyRows({ months, ...data });
  const conversion = trialConversion(data.subscriptions);
  const reasons = cancellationReasons(data.orgs, since);
  const plans = revenue ? revenueByPlan(revenue.lines) : [];
  // Normally all GBP; any other currency is shown alongside, never converted.
  const totals = new Map<string, number>();
  for (const p of plans) totals.set(p.currency, (totals.get(p.currency) ?? 0) + p.monthly);
  const totalText = totals.size
    ? [...totals].map(([currency, amount]) => money(amount, currency)).join(" + ")
    : money(0);

  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        description={`The last ${MONTHS} months of sign-ups, trials and revenue.`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Trials waiting for review" value={String(data.pendingReviews)} />
        <Stat
          label="Trial to paid"
          value={conversion.rate === null ? "—" : `${Math.round(conversion.rate * 100)}%`}
          note={`${conversion.converted} paying, ${conversion.lost} ended`}
        />
        <Stat
          label="Monthly recurring revenue"
          value={revenue ? totalText : "—"}
          note={
            revenue ? `From Stripe, ${dateTime(new Date(revenue.at))}` : "Stripe isn't available"
          }
        />
        <Stat
          label="Cancellations"
          value={String(rows.reduce((s, r) => s + r.cancellations, 0))}
          note={`Last ${MONTHS} months`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By month</CardTitle>
          <CardDescription>
            Time to approve is from sign-up to an admin&apos;s approval; automatic approvals
            aren&apos;t counted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            head={[
              "Month",
              "Sign-ups",
              "New organisations",
              "Approved",
              "Declined or expired",
              "Median time to approve",
              "Cancellations",
            ]}
          >
            {rows.map((r) => (
              <Tr key={r.month}>
                <Td className="font-medium whitespace-nowrap">{monthLabel(r.month)}</Td>
                <Td className="tabular-nums">{r.signUps}</Td>
                <Td className="tabular-nums">{r.newOrganisations}</Td>
                <Td className="tabular-nums">{r.approved}</Td>
                <Td className="tabular-nums">{r.declined}</Td>
                <Td className="tabular-nums">{hours(r.medianHoursToApprove)}</Td>
                <Td className="tabular-nums">{r.cancellations}</Td>
              </Tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recurring revenue by plan</CardTitle>
            <CardDescription>
              Active and past-due subscriptions, normalised to a month, before VAT. Trials
              aren&apos;t included; metered overage isn&apos;t either.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {revenue ? "No paying subscriptions." : "Stripe isn't available."}
              </p>
            ) : (
              <DataTable head={["Plan", "Subscriptions", "A month"]}>
                {plans.map((p) => (
                  <Tr key={`${p.planName}-${p.currency}`}>
                    <Td>{p.planName}</Td>
                    <Td className="tabular-nums">{p.subscriptions}</Td>
                    <Td className="tabular-nums">{money(p.monthly, p.currency)}</Td>
                  </Tr>
                ))}
              </DataTable>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Why customers cancelled</CardTitle>
            <CardDescription>Reasons given in the last {MONTHS} months (CANC-01).</CardDescription>
          </CardHeader>
          <CardContent>
            {reasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cancellations.</p>
            ) : (
              <DataTable head={["Reason", "Organisations"]}>
                {reasons.map((r) => (
                  <Tr key={r.reason}>
                    <Td>{r.reason}</Td>
                    <Td className="tabular-nums">{r.count}</Td>
                  </Tr>
                ))}
              </DataTable>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
