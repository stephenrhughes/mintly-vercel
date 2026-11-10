import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";
import { pendingSummary } from "@/lib/review/queries";
import { waitingFor } from "@/lib/review/rules";

export const metadata: Metadata = { title: "Admin" };

const title = "Admin";

export default function AdminPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Admin />
    </Suspense>
  );
}

// The admin area (plan §6.8). Only Mintly admins who have completed MFA get
// this far (SEC-01); everyone else gets a 404.
async function Admin() {
  const user = await requireAdmin("/admin");
  const pending = await pendingSummary();
  return (
    <div className="grid gap-8">
      <PageHeader title={title} description="Manage Mintly customers, plans and settings." />
      {/* plan §6.8: trials awaiting review, with the oldest wait. */}
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
            <a href={appPath("/admin/reviews")}>Open the review queue</a>
          </Button>
        </CardFooter>
      </Card>
      <Card className="border-admin/30">
        <CardHeader>
          <CardTitle>Signed in as an admin</CardTitle>
          <CardDescription>
            {user.email}, with two-step verification. The admin tools listed in the menu will appear
            here as they are released.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
