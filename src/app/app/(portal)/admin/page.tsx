import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";

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
  return (
    <div className="grid gap-8">
      <PageHeader title={title} description="Manage Mintly customers, plans and settings." />
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
