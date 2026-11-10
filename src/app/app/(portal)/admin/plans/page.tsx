import type { Metadata } from "next";
import { Suspense } from "react";

import { Code, DataTable, ExternalAnchor, Td, Tr } from "@/components/admin/ui";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadCatalogueHealth } from "@/lib/admin/plans-health-server";
import { requireAdmin } from "@/lib/auth/session";
import { money } from "@/lib/billing/format";
import { getStripe } from "@/lib/stripe/client";
import { stripeDashboardUrl } from "@/lib/stripe/dashboard";

export const metadata: Metadata = { title: "Plans" };

const title = "Plans";

export default function PlansPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Plans />
    </Suspense>
  );
}

// The plan catalogue and its health (ADM-08, ADM-09). Stripe price metadata
// is the source of truth (ADM-10); this page only reads it.
async function Plans() {
  await requireAdmin("/admin/plans");
  const description =
    "Every Stripe price tagged with product metadata or held by a live customer, checked against API Gateway.";
  if (!getStripe()) {
    return (
      <div className="grid gap-8">
        <PageHeader title={title} description={description} />
        <Alert>
          <AlertDescription>Stripe isn&apos;t configured on this deployment.</AlertDescription>
        </Alert>
      </div>
    );
  }
  const health = await loadCatalogueHealth();
  const problems = health.plans.filter((p) => p.issues.length).length;

  return (
    <div className="grid gap-8">
      <PageHeader title={title} description={description} />

      <Alert variant={problems || health.missingPrices.length ? "destructive" : "success"}>
        <AlertDescription>
          {problems || health.missingPrices.length
            ? `${problems} ${problems === 1 ? "price needs" : "prices need"} attention${health.missingPrices.length ? `, and ${health.missingPrices.length} live ${health.missingPrices.length === 1 ? "price is" : "prices are"} missing from Stripe` : ""}. Fix the metadata in Stripe; this page updates within 5 minutes.`
            : "The catalogue is healthy."}
          {!health.usagePlansChecked
            ? " Usage plans couldn't be listed, so they weren't checked."
            : null}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Prices</CardTitle>
          <CardDescription>Prices with problems are listed first.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            head={["Price", "Product and tier", "Amount", "Seats", "Usage plans", "Live customers"]}
          >
            {health.plans.map((plan) => (
              <Tr key={plan.id}>
                <Td>
                  <span className="font-medium">{plan.name}</span>
                  <div>
                    <ExternalAnchor href={stripeDashboardUrl("prices", plan.id)}>
                      {plan.id}
                    </ExternalAnchor>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {!plan.active ? <Badge variant="outline">Inactive</Badge> : null}
                    {plan.custom ? <Badge variant="secondary">Custom</Badge> : null}
                  </div>
                  {plan.issues.length ? (
                    <ul className="mt-2 list-disc pl-4 text-xs text-destructive">
                      {plan.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}
                </Td>
                <Td>
                  {plan.product ?? "—"}
                  <div className="text-xs text-muted-foreground">
                    {[plan.tier, plan.interval].filter(Boolean).join(", ") || "No tier"}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">
                  {plan.unitAmount !== null
                    ? money(plan.unitAmount, plan.currency ?? "gbp")
                    : "Metered"}
                </Td>
                <Td>{plan.maxTeamSize ?? "—"}</Td>
                <Td className="text-xs">
                  <div>Paid: {plan.usagePlanId ? <Code>{plan.usagePlanId}</Code> : "—"}</div>
                  <div className="mt-1">
                    Trial: {plan.trialUsagePlanId ? <Code>{plan.trialUsagePlanId}</Code> : "—"}
                  </div>
                </Td>
                <Td>{plan.customers}</Td>
              </Tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      {health.missingPrices.length ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle>Live customers on prices Stripe didn&apos;t return</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {health.missingPrices.map((p) => (
                <li key={p.priceId}>
                  <Code>{p.priceId}</Code>: {p.customers}{" "}
                  {p.customers === 1 ? "subscription" : "subscriptions"}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {health.unusedUsagePlans.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Usage plans no price uses</CardTitle>
            <CardDescription>
              Not necessarily a problem: some may serve EISCD keys or older customers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {health.unusedUsagePlans.map((p) => (
                <li key={p.id}>
                  {p.name} <Code>{p.id}</Code>
                  {p.quota ? (
                    <span className="text-muted-foreground">
                      {" "}
                      ({p.quota.limit} a {p.quota.period.toLowerCase()})
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
