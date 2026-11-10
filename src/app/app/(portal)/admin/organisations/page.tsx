import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { StatusBadge } from "@/components/admin/shared";
import { DataTable, SubscriptionBadge, Td, Tr, selectClass } from "@/components/admin/ui";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listOrganisationRows } from "@/lib/admin/organisations";
import {
  filterAndSort,
  isCancelling,
  isOrgFilter,
  isOrgSort,
  isOverQuota,
  isOverSeats,
  nextDate,
  ORG_FILTERS,
  ORG_SORTS,
  type OrgFilter,
  type OrgSort,
} from "@/lib/admin/organisations-list";
import { requireAdmin } from "@/lib/auth/session";
import { longDate } from "@/lib/billing/format";
import { appPath } from "@/lib/hosts";
import { numberWithCommas } from "@/lib/usage/series";

export const metadata: Metadata = { title: "Organisations" };

const title = "Organisations";

export default function OrganisationsPage(props: PageProps<"/app/admin/organisations">) {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Organisations {...props} />
    </Suspense>
  );
}

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

// Every customer, from the database and Stripe together (ADM-01, ADM-02).
async function Organisations({ searchParams }: PageProps<"/app/admin/organisations">) {
  await requireAdmin("/admin/organisations");
  const params = await searchParams;
  const q = one(params.q)?.slice(0, 200) ?? "";
  const filter: OrgFilter = isOrgFilter(params.filter) ? params.filter : "all";
  const sort: OrgSort = isOrgSort(params.sort) ? params.sort : "name";
  const desc = params.dir === "desc";

  const { rows, stripeAvailable } = await listOrganisationRows();
  const shown = filterAndSort(rows, { q, filter, sort, desc });

  const sortHref = (key: OrgSort) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (filter !== "all") next.set("filter", filter);
    next.set("sort", key);
    if (key === sort && !desc) next.set("dir", "desc");
    return appPath(`/admin/organisations?${next}`);
  };
  const sortLink = (key: OrgSort, label: string) => (
    <Link href={sortHref(key)} className="hover:underline">
      {label}
      {key === sort ? (desc ? " ↓" : " ↑") : ""}
    </Link>
  );

  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        description="Every customer, with the database and Stripe side by side. Drift means they disagree."
        action={
          <Button asChild>
            <Link href={appPath("/admin/customers/new")}>Set up a customer</Link>
          </Button>
        }
      />

      {!stripeAvailable ? (
        <Alert>
          <AlertDescription>
            Stripe isn&apos;t available, so this list shows the database only and drift isn&apos;t
            checked.
          </AlertDescription>
        </Alert>
      ) : null}

      <form className="grid gap-3 sm:grid-cols-[1fr_16rem_auto] sm:items-end" role="search">
        <div className="grid gap-1">
          <label htmlFor="q" className="text-sm font-medium">
            Search
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Name, email or Stripe ID" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="filter" className="text-sm font-medium">
            Show
          </label>
          <select id="filter" name="filter" defaultValue={filter} className={selectClass}>
            {Object.entries(ORG_FILTERS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <input type="hidden" name="sort" value={sort} />
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm text-muted-foreground">
            {shown.length} of {rows.length} {rows.length === 1 ? "organisation" : "organisations"}
          </p>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches.</p>
          ) : (
            <DataTable
              head={[
                sortLink("name", ORG_SORTS.name),
                "Plan",
                "Stripe",
                "Database",
                sortLink("renewal", "Trial end or renewal"),
                "Seats",
                sortLink("usage", "Checks (30 days)"),
                sortLink("drift", ORG_SORTS.drift),
              ]}
            >
              {shown.map((row) => {
                const date = nextDate(row);
                return (
                  <Tr key={row.id ?? row.stripeCustomerId}>
                    <Td>
                      {row.id ? (
                        <Link
                          href={appPath(`/admin/organisations/${row.id}`)}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{row.name}</span>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {row.ownerEmail ?? "No owner"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.reviewStatus && row.reviewStatus !== "approved" ? (
                          <StatusBadge status={row.reviewStatus} />
                        ) : null}
                        {row.source === "stripe" ? (
                          <Badge variant="outline">Only in Stripe</Badge>
                        ) : null}
                        {row.source === "database" &&
                        stripeAvailable &&
                        row.stripeSubscriptionId ? (
                          <Badge variant="outline">Not in Stripe</Badge>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      {row.planName ?? (row.product === "eiscd" ? "EISCD" : "—")}
                      {row.interval ? (
                        <div className="text-xs text-muted-foreground">{row.interval}</div>
                      ) : null}
                      {row.extraUsers > 0 ? (
                        <div className="text-xs text-muted-foreground">+{row.extraUsers} seats</div>
                      ) : null}
                    </Td>
                    <Td>
                      <SubscriptionBadge status={row.stripeStatus} />
                      {isCancelling(row) ? (
                        <div className="mt-1 text-xs text-muted-foreground">Cancelling</div>
                      ) : null}
                    </Td>
                    <Td>
                      <SubscriptionBadge status={row.storedStatus} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {date ? longDate(date) : "—"}
                      {row.trialing ? (
                        <div className="text-xs text-muted-foreground">Trial ends</div>
                      ) : null}
                    </Td>
                    <Td className={isOverSeats(row) ? "font-medium text-destructive" : undefined}>
                      {row.seatsUsed} of {row.seatLimit ?? "?"}
                    </Td>
                    <Td className={isOverQuota(row) ? "font-medium text-destructive" : undefined}>
                      {numberWithCommas(row.checks30d)}
                      {row.allowance ? (
                        <div className="text-xs text-muted-foreground">
                          of {numberWithCommas(row.allowance)}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      {row.driftCount > 0 ? (
                        <Badge variant="destructive">{row.driftCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </DataTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
