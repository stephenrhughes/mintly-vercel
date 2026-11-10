import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { dateTime } from "@/components/admin/shared";
import { Code, DataTable, Td, Tr } from "@/components/admin/ui";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { offerStatus, type OfferStatus } from "@/lib/admin/offers";
import { organisationOptions } from "@/lib/admin/server";
import { listOffers } from "@/lib/admin/setup-server";
import { priceOptions } from "@/lib/admin/subscription-changes-server";
import { requireAdmin } from "@/lib/auth/session";
import { longDate } from "@/lib/billing/format";
import { appPath } from "@/lib/hosts";
import { getStripe } from "@/lib/stripe/client";

import { OfferForm, RevokeOfferForm } from "./offer-forms";

export const metadata: Metadata = { title: "Offers" };

const title = "Offers";

export default function OffersPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Offers />
    </Suspense>
  );
}

const statusBadge: Record<
  OfferStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  accepted: { label: "Accepted", variant: "default" },
  expired: { label: "Expired", variant: "outline" },
  revoked: { label: "Withdrawn", variant: "outline" },
};

// Offers (ADM-11, OFF-01): create, list with status, withdraw. Customers
// accept them from phase 7.
async function Offers() {
  await requireAdmin("/admin/offers");
  const stripe = Boolean(getStripe());
  const [offers, orgs, prices] = await Promise.all([
    listOffers(),
    organisationOptions(),
    stripe ? priceOptions() : Promise.resolve([]),
  ]);
  const now = new Date();
  const priceLabel = new Map(prices.map((p) => [p.id, p.label]));
  const defaultExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        description="A bespoke price for one customer. Owners will see open offers on their subscription page and accept them through Stripe Checkout (phase 7)."
      />
      <Card>
        <CardHeader>
          <CardTitle>Offers ({offers.length})</CardTitle>
          <CardDescription>The latest 200, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No offers yet.</p>
          ) : (
            <DataTable head={["Offer", "For", "Price", "Status", ""]}>
              {offers.map((o) => {
                const status = offerStatus(o, now);
                return (
                  <Tr key={o.id}>
                    <Td>
                      <span className="font-medium">{o.headline}</span>
                      {o.message ? (
                        <p className="text-xs text-muted-foreground">{o.message}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {dateTime(o.createdAt)} by {o.createdBy ?? "unknown"}
                      </p>
                    </Td>
                    <Td>
                      {o.orgId ? (
                        <Link
                          href={appPath(`/admin/organisations/${o.orgId}`)}
                          className="text-primary hover:underline"
                        >
                          {o.orgName ?? "An organisation"}
                        </Link>
                      ) : (
                        o.email
                      )}
                    </Td>
                    <Td className="text-xs">
                      {priceLabel.get(o.stripePriceId) ?? <Code>{o.stripePriceId}</Code>}
                    </Td>
                    <Td>
                      <Badge variant={statusBadge[status].variant}>
                        {statusBadge[status].label}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {status === "accepted" && o.acceptedAt
                          ? longDate(o.acceptedAt)
                          : status === "revoked" && o.revokedAt
                            ? longDate(o.revokedAt)
                            : `Expires ${longDate(o.expiresAt)}`}
                      </div>
                    </Td>
                    <Td>{status === "pending" ? <RevokeOfferForm offerId={o.id} /> : null}</Td>
                  </Tr>
                );
              })}
            </DataTable>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Make an offer</CardTitle>
        </CardHeader>
        <CardContent>
          {stripe ? (
            <OfferForm prices={prices} orgs={orgs} defaultExpiry={defaultExpiry} />
          ) : (
            <Alert>
              <AlertDescription>Stripe isn&apos;t configured on this deployment.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
