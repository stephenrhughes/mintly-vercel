import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { isPlanTier, PLANS } from "@/lib/billing/plans";
import { appPath } from "@/lib/hosts";
import { listPendingReviews, listSuspended, recentDecisions } from "@/lib/review/queries";
import { waitingFor } from "@/lib/review/rules";

import { actionText, Check, dateTime } from "@/components/admin/shared";

export const metadata: Metadata = { title: "Trial reviews" };

const title = "Trial reviews";

export default function ReviewsPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Reviews />
    </Suspense>
  );
}

// The review queue (plan §6.11, APPR-04): pending trials, oldest first,
// with the signals that help spot repeated or fake sign-ups.
async function Reviews() {
  await requireAdmin("/admin/reviews");
  const [pending, suspended, decisions] = await Promise.all([
    listPendingReviews(),
    listSuspended(),
    recentDecisions(),
  ]);
  const now = new Date();

  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        description="New trials wait here until an admin approves them. Reviews usually take less than one working day; pending trials expire after 7 days."
        action={
          <Button asChild variant="outline">
            <Link href={appPath("/admin/reviews/domains")}>Trusted and blocked domains</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Waiting for review ({pending.length})</CardTitle>
          <CardDescription>Oldest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to review.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-medium">Organisation</th>
                    <th className="py-2 pr-4 font-medium">Owner</th>
                    <th className="py-2 pr-4 font-medium">Plan</th>
                    <th className="py-2 pr-4 font-medium">Checks</th>
                    <th className="py-2 pr-4 font-medium">Country</th>
                    <th className="py-2 font-medium">Waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((review) => (
                    <tr key={review.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <Link
                          href={appPath(`/admin/reviews/${review.id}`)}
                          className="font-medium text-primary hover:underline"
                        >
                          {review.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{review.signals.email ?? "Unknown"}</td>
                      <td className="py-3 pr-4">
                        {isPlanTier(review.signals.tier)
                          ? PLANS[review.signals.tier].name
                          : "Other"}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="grid gap-0.5">
                          <Check value={review.signals.mx} yes="Mail" no="No mail" />
                          <Check
                            value={review.signals.company_matches_domain}
                            yes="Name matches"
                            no="Name differs"
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-4">{review.signals.country ?? "Unknown"}</td>
                      <td className="py-3" title={dateTime(review.createdAt)}>
                        {waitingFor(review.createdAt, now)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {suspended.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Suspended ({suspended.length})</CardTitle>
            <CardDescription>Their keys are off until they are reinstated.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {suspended.map((org) => (
                <li key={org.id}>
                  <Link
                    href={appPath(`/admin/reviews/${org.id}`)}
                    className="font-medium text-primary hover:underline"
                  >
                    {org.name}
                  </Link>
                  {org.reviewedAt ? (
                    <span className="text-muted-foreground"> since {dateTime(org.reviewedAt)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent decisions</CardTitle>
        </CardHeader>
        <CardContent>
          {decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions yet.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {decisions.map((entry) => (
                <li key={entry.id}>
                  <span className="text-muted-foreground">{dateTime(entry.at)}:</span>{" "}
                  {actionText[entry.action] ?? entry.action}{" "}
                  {entry.orgId ? (
                    <Link
                      href={appPath(`/admin/reviews/${entry.orgId}`)}
                      className="font-medium text-primary hover:underline"
                    >
                      {entry.orgName ?? "an organisation"}
                    </Link>
                  ) : null}
                  <span className="text-muted-foreground">
                    {" "}
                    by {entry.actorEmail ?? "the system"}
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
