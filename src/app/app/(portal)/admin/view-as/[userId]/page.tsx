import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Field } from "@/components/admin/ui";
import { PageHeader } from "@/components/app/page-header";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isUuid } from "@/lib/admin/action";
import { loadViewAsTarget } from "@/lib/admin/view-as";
import { requireAdmin } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";

import { startViewAsAction } from "./actions";

export const metadata: Metadata = { title: "View as customer" };

const title = "View as customer";

export default function ViewAsPage(props: PageProps<"/app/admin/view-as/[userId]">) {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <ViewAs {...props} />
    </Suspense>
  );
}

// ADM-13: open the portal as this user sees it, read-only, for an hour.
async function ViewAs({ params }: PageProps<"/app/admin/view-as/[userId]">) {
  const { userId } = await params;
  const admin = await requireAdmin(`/admin/view-as/${userId}`);
  if (!isUuid(userId)) notFound();
  const target = await loadViewAsTarget(userId);
  if (!target) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        description="See the portal exactly as this person does, to help with a support question."
      />
      <Card className="border-admin/40">
        <CardHeader>
          <CardTitle>{target.name ?? target.email}</CardTitle>
          <CardDescription>
            Read-only for up to an hour: every action is disabled, the API key stays hidden, and the
            session is recorded in the audit log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Field label="Email">{target.email}</Field>
            <Field label="Organisation">
              {target.orgId ? (
                <Link
                  href={appPath(`/admin/organisations/${target.orgId}`)}
                  className="text-primary hover:underline"
                >
                  {target.orgName}
                </Link>
              ) : (
                "None"
              )}
            </Field>
            <Field label="Role">{target.role ?? "None"}</Field>
          </dl>
        </CardContent>
        <CardFooter>
          {target.userId === admin.id ? (
            <p className="text-sm text-muted-foreground">This is you.</p>
          ) : (
            <form action={startViewAsAction.bind(null, target.userId)}>
              <SubmitButton pendingLabel="Opening…">Start viewing</SubmitButton>
            </form>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
