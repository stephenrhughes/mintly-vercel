import { CircleAlert, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type AppUser, requireUser } from "@/lib/auth/session";
import { SANDBOX_API } from "@/lib/bank-api/access";
import { resolveCheckAccess } from "@/lib/bank-api/access-server";
import { SANDBOX_TEST_VALUES } from "@/lib/bank-api/requests";
import { canSeeKey } from "@/lib/billing/permissions";
import { appPath } from "@/lib/hosts";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

import { ToolsWorkspace } from "./tools-workspace";

export const metadata: Metadata = { title: "Tools" };

const title = "Tools";
const description = "Check sort codes, account numbers, IBANs and SWIFT/BIC codes.";

export default function ToolsPage() {
  return (
    <Suspense fallback={<PageHeader title={title} description={description} />}>
      <Tools />
    </Suspense>
  );
}

// The web tools (plan §6.2, TOOL-*). Checks go through the server, which
// adds the organisation's key, so the key never reaches this page (Q2).
async function Tools() {
  const user = await requireUser("/tools");
  const membership = user.membership;
  const access = await resolveCheckAccess(user);
  const header = (
    <PageHeader
      title={title}
      description={description}
      action={
        <Button asChild variant="outline" size="sm">
          <a href={`${siteConfig.canonicalUrl}/docs`} target="_blank" rel="noreferrer">
            API documentation
          </a>
        </Button>
      }
    />
  );

  if (access.mode === "denied") {
    return (
      <div className="grid gap-8">
        {header}
        <Card>
          <CardHeader>
            <CardTitle>The tools aren&apos;t available</CardTitle>
            <CardDescription>{access.reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href={appPath(membership ? "/subscription" : "/subscribe")}>
                {membership ? "View your subscription" : "Choose a plan"}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sandbox = access.mode === "sandbox";
  return (
    <div className="grid gap-8">
      {header}

      {sandbox ? (
        // APPR-03: while the account is reviewed, checks use the sandbox.
        <Alert>
          <FlaskConical aria-hidden />
          <AlertTitle>Sandbox mode</AlertTitle>
          <AlertDescription>
            <p>
              We&apos;re reviewing your account, so checks here use the sandbox and return test
              data. Real checks start once your account is approved. These values return a valid
              result; anything else is not found:
            </p>
            <ul className="mt-1 grid gap-0.5 font-mono text-xs text-foreground">
              <li>
                Sort code {SANDBOX_TEST_VALUES.sortCode}, account{" "}
                {SANDBOX_TEST_VALUES.accountNumber}
              </li>
              <li>IBAN {SANDBOX_TEST_VALUES.iban}</li>
              <li>BIC {SANDBOX_TEST_VALUES.bic}</li>
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {!sandbox && access.trialing ? (
        <Alert>
          <CircleAlert aria-hidden />
          <AlertDescription>
            Trial plans have a daily limit and check bulk lists more slowly. Bulk results can be
            downloaded on paid plans.
          </AlertDescription>
        </Alert>
      ) : null}

      <ToolsWorkspace
        mode={access.mode}
        canDownload={access.canDownload}
        trialing={access.trialing}
        isOwner={membership?.role === "owner"}
        apiBaseUrl={sandbox ? SANDBOX_API : `${siteConfig.apiBaseUrl}/bankAccount/v1`}
        changePlanHref={appPath("/subscription/change")}
        keyHref={canSeeKey(membership) ? appPath("/subscription#api-key") : null}
      />

      <Suspense fallback={null}>
        <CheckCounts user={user} />
      </Suspense>
    </div>
  );
}

const COUNT_DAYS = 30;

// Plan §6.4: each person sees their own count; owners see everyone's.
async function CheckCounts({ user }: { user: AppUser }) {
  const membership = user.membership;
  if (!membership) return null;
  const now = new Date();
  const since = new Date(now.getTime() - COUNT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_counts", { p_since: since });
  if (error) {
    console.error("reading check counts failed", error.message);
    return null;
  }
  const counts = (data ?? []) as Array<{ user_id: string | null; checks: number }>;
  const mine = counts.find((row) => row.user_id === user.id)?.checks ?? 0;
  const isOwner = membership.role === "owner";

  let people: Array<{ name: string; checks: number }> = [];
  if (isOwner && counts.length > 0) {
    const ids = counts.map((row) => row.user_id).filter((id): id is string => Boolean(id));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .in("id", ids)
      .returns<
        Array<{ id: string; email: string; first_name: string | null; last_name: string | null }>
      >();
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    people = counts
      .map((row) => {
        const p = row.user_id ? byId.get(row.user_id) : undefined;
        const name = p
          ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email
          : "Former team member";
        return { name, checks: Number(row.checks) };
      })
      .sort((a, b) => b.checks - a.checks);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checks in the last {COUNT_DAYS} days</CardTitle>
        <CardDescription>
          You made {Number(mine).toLocaleString("en-GB")} check{Number(mine) === 1 ? "" : "s"} on
          this page. Checks made through the API are on the{" "}
          <a
            href={appPath("/usage")}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            usage page
          </a>
          .
        </CardDescription>
      </CardHeader>
      {isOwner && people.length > 0 ? (
        <CardContent>
          <table className="w-full text-sm">
            <caption className="sr-only">Checks on this page by person</caption>
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 font-medium">
                  Person
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Checks
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((person, index) => (
                <tr key={index} className="border-b last:border-b-0">
                  <td className="py-2">{person.name}</td>
                  <td className="py-2 text-right tabular-nums">
                    {person.checks.toLocaleString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      ) : null}
    </Card>
  );
}
