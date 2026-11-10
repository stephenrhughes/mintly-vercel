import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { priceOptions } from "@/lib/admin/subscription-changes-server";
import { requireAdmin } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";
import { getStripe } from "@/lib/stripe/client";

import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Set up a customer" };

const title = "Set up a customer";

export default function NewCustomerPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <NewCustomer />
    </Suspense>
  );
}

// ADM-12, plan §6.7: any customer, any product, approved straight away.
async function NewCustomer() {
  await requireAdmin("/admin/customers/new");
  const description =
    "For enterprise and EISCD customers: creates the organisation, its Stripe customer and subscription and its API key, then invites the owner. Approved straight away.";
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
  const prices = await priceOptions();
  return (
    <div className="grid gap-8">
      <PageHeader title={title} description={description} />
      <Card>
        <CardHeader>
          <CardTitle>The customer</CardTitle>
          <CardDescription>
            Invoices go to the owner&apos;s email. The key is created in the price&apos;s usage plan
            (the trial plan during a trial).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupForm prices={prices} organisationHref={appPath("/admin/organisations")} />
        </CardContent>
      </Card>
    </div>
  );
}
