import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listOrganisationRows } from "@/lib/admin/organisations";
import { type OrgFilter, overviewCounts } from "@/lib/admin/organisations-list";
import { requireAdmin } from "@/lib/auth/session";
import { longDate } from "@/lib/billing/format";
import { appPath } from "@/lib/hosts";
import { pendingSummary } from "@/lib/review/queries";
import { waitingFor } from "@/lib/review/rules";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

const title = "Admin";

export default function AdminPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Admin />
    </Suspense>
  );
}

const listHref = (filter: OrgFilter) => appPath(`/admin/organisations?filter=${filter}`);

function Stat({
  label,
  value,
  filter,
  alert,
}: {
  label: string;
  value: number;
  filter: OrgFilter;
  alert?: boolean;
}) {
  return (
    <Link
      href={listHref(filter)}
      className={cn(
        "grid gap-1 rounded-lg border bg-background p-4 transition-colors hover:bg-accent",
        alert && value > 0 && "border-destructive/50",
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums",
          alert && value > 0 && "text-destructive",
        )}
      >
        {value}
      </span>
    </Link>
  );
}

// The admin overview (plan §6.8). Only Mintly admins who have completed MFA
// get this far (SEC-01); everyone else gets a 404.
async function Admin() {
  await requireAdmin("/admin");
  const [pending, list] = await Promise.all([pendingSummary(), listOrganisationRows()]);
  const counts = overviewCounts(list.rows, new Date());

  return (
    <div className="grid gap-8">
      <PageHeader title={title} description="Manage Mintly customers, plans and settings." />

      <Card className={pending.count > 0 ? "border-primary/40" : undefined}>
        <CardHeader>
          <CardTitle>
            {pending.count === 0
              ? "No trials waiting for review"
              : `${pending.count} ${pending.count === 1 ? "trial" : "trials"} waiting for review`}
          </CardTitle>
          {pending.oldest ? (
            <CardDescription>
              The oldest has waited {waitingFor(pending.oldest, new Date())}.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardFooter>
          <Button asChild variant={pending.count > 0 ? "default" : "outline"}>
            <Link href={appPath("/admin/reviews")}>Open the review queue</Link>
          </Button>
        </CardFooter>
      </Card>

      {!list.stripeAvailable ? (
        <Alert>
          <AlertDescription>
            Stripe isn&apos;t available, so these figures come from the database alone.
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="attention" className="grid gap-3">
        <h2 id="attention" className="text-lg font-semibold">
          Needs attention
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Drift from Stripe" value={counts.drift} filter="drift" alert />
          <Stat label="Past due" value={counts.byStatus.past_due} filter="past_due" alert />
          <Stat label="Over seat limit" value={counts.overSeats} filter="over_seats" alert />
          <Stat label="Over 80% of allowance" value={counts.overQuota} filter="over_quota" alert />
        </div>
      </section>

      <section aria-labelledby="status" className="grid gap-3">
        <h2 id="status" className="text-lg font-semibold">
          Organisations by status
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Trialing" value={counts.byStatus.trialing} filter="trialing" />
          <Stat label="Active" value={counts.byStatus.active} filter="active" />
          <Stat label="Cancelling" value={counts.byStatus.cancelling} filter="cancelling" />
          <Stat label="Expired" value={counts.byStatus.expired} filter="expired" />
          <Stat label="Pending review" value={counts.pendingReview} filter="pending_review" />
          <Stat label="Suspended" value={counts.suspended} filter="suspended" />
          <Stat label="Only in Stripe" value={counts.stripeOnly} filter="stripe_only" alert />
          <Stat label="All" value={list.rows.length} filter="all" />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Trials ending within 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          {counts.trialsEndingSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {counts.trialsEndingSoon.map((row) => (
                <li key={row.id ?? row.stripeCustomerId}>
                  {row.id ? (
                    <Link
                      href={appPath(`/admin/organisations/${row.id}`)}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}{" "}
                  <span className="text-muted-foreground">
                    {row.planName ? `${row.planName}, ` : ""}ends{" "}
                    {row.trialEnd ? longDate(row.trialEnd) : "soon"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
