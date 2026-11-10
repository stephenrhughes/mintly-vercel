import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTable, Td, Tr } from "@/components/admin/ui";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdmins } from "@/lib/admin/server";
import { requireAdmin } from "@/lib/auth/session";
import { longDate } from "@/lib/billing/format";

import { GrantForm, RevokeForm } from "./admin-forms";

export const metadata: Metadata = { title: "Admins" };

const title = "Admins";

export default function AdminsPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Admins />
    </Suspense>
  );
}

// Mintly admins (plan §6.8): grant or revoke, never removing the last one.
async function Admins() {
  const me = await requireAdmin("/admin/admins");
  const admins = await listAdmins();

  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        description="Mintly admins can see and change every customer. Each one must use an authenticator app."
      />
      <Card>
        <CardHeader>
          <CardTitle>Admins ({admins.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable head={["Person", "Authenticator app", "Since", ""]}>
            {admins.map((a) => (
              <Tr key={a.id}>
                <Td>
                  <span className="font-medium">{a.name ?? a.email}</span>
                  {a.name ? <div className="text-xs text-muted-foreground">{a.email}</div> : null}
                  {a.id === me.id ? <Badge variant="secondary">You</Badge> : null}
                </Td>
                <Td>
                  {a.hasMfa === null ? (
                    "Unknown"
                  ) : a.hasMfa ? (
                    "Set up"
                  ) : (
                    <span className="text-destructive">Not yet: asked on first visit</span>
                  )}
                </Td>
                <Td>{longDate(a.createdAt)}</Td>
                <Td>
                  {admins.length > 1 ? <RevokeForm userId={a.id} self={a.id === me.id} /> : null}
                </Td>
              </Tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add an admin</CardTitle>
          <CardDescription>They must already have a Mintly account.</CardDescription>
        </CardHeader>
        <CardContent>
          <GrantForm />
        </CardContent>
      </Card>
    </div>
  );
}
