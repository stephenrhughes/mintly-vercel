import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultInfoRequest } from "@/emails/review";
import { requireAdmin } from "@/lib/auth/session";
import { isPlanTier, PLANS } from "@/lib/billing/plans";
import { appPath } from "@/lib/hosts";
import { getReview } from "@/lib/review/queries";
import { normaliseDomain, waitingFor } from "@/lib/review/rules";

import { actionText, Check, dateTime, StatusBadge } from "../shared";
import { ReviewForms } from "./review-forms";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage(props: PageProps<"/app/admin/reviews/[orgId]">) {
  return (
    <Suspense fallback={<PageHeader title="Review" />}>
      <Review {...props} />
    </Suspense>
  );
}

const decisionText: Record<string, string> = {
  needs_review: "Held for review",
  trusted_domain: "Approved automatically: trusted domain",
  approved_org_domain: "Approved automatically: an approved organisation uses this domain",
  sso_domain: "Approved automatically: SSO domain",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:col-span-2">{children}</dd>
    </div>
  );
}

// One organisation's review (plan §6.11, APPR-04, APPR-05, APPR-08).
async function Review({ params }: PageProps<"/app/admin/reviews/[orgId]">) {
  const { orgId } = await params;
  await requireAdmin(`/admin/reviews/${orgId}`);
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) notFound();
  const review = await getReview(orgId);
  if (!review) notFound();

  const s = review.signals;
  const domain = normaliseDomain(s.domain) ?? normaliseDomain(review.owner?.email.split("@").pop());
  const plan = isPlanTier(s.tier)
    ? PLANS[s.tier].name
    : (review.subscription?.priceId ?? "Unknown");

  return (
    <div className="grid gap-8">
      <PageHeader
        title={review.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={review.status} />
            Signed up {dateTime(review.createdAt)}
            {review.status === "pending_review"
              ? `, waiting ${waitingFor(review.createdAt, new Date())}`
              : ""}
          </span>
        }
        action={
          <Link
            href={appPath("/admin/reviews")}
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to the queue
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="grid gap-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Sign-up</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <Row label="Owner">
                  {review.owner ? (
                    <>
                      {review.owner.name ? `${review.owner.name}, ` : ""}
                      {review.owner.email}
                    </>
                  ) : (
                    "No owner"
                  )}
                </Row>
                <Row label="Phone">{s.phone ?? review.owner?.phone ?? "Not given"}</Row>
                <Row label="Company entered">
                  <span className="flex flex-wrap items-center gap-3">
                    {s.company_name ?? "Not given"}
                    <Check
                      value={s.company_matches_domain}
                      yes="Matches the domain"
                      no="Doesn't match the domain"
                    />
                  </span>
                </Row>
                <Row label="Email domain">
                  <span className="flex flex-wrap items-center gap-3">
                    {domain ?? "Unknown"}
                    <Check value={s.mx} yes="Has mail records" no="No mail records" />
                    <Check value={s.website} yes="Has a website" no="No website" />
                  </span>
                </Row>
                <Row label="Plan">
                  {plan}
                  {s.interval ? `, ${s.interval}` : ""}
                </Row>
                <Row label="Signed up from">{s.country ?? "Unknown country"}</Row>
                <Row label="Decision at sign-up">
                  {s.decision ? (decisionText[s.decision] ?? s.decision) : "Not recorded"}
                </Row>
                {review.subscription ? (
                  <Row label="Stripe subscription">
                    {review.subscription.stripeSubscriptionId} ({review.subscription.status}
                    {review.subscription.trialEnd
                      ? `, trial ends ${dateTime(review.subscription.trialEnd)}`
                      : ""}
                    )
                  </Row>
                ) : null}
                {review.reviewNote ? <Row label="Latest note">{review.reviewNote}</Row> : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Earlier sign-ups that match</CardTitle>
            </CardHeader>
            <CardContent>
              {review.related.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No other organisations share this domain, email or IP address.
                </p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {review.related.map((org) => (
                    <li key={org.id} className="flex flex-wrap items-center gap-2">
                      <Link
                        href={appPath(`/admin/reviews/${org.id}`)}
                        className="font-medium text-primary hover:underline"
                      >
                        {org.name}
                      </Link>
                      <StatusBadge status={org.status} />
                      <span className="text-muted-foreground">
                        same {org.matchedOn.join(" and ")}, {dateTime(org.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              {review.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No decisions yet.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {review.history.map((entry) => (
                    <li key={entry.id}>
                      <span className="text-muted-foreground">{dateTime(entry.at)}:</span>{" "}
                      {actionText[entry.action] ?? entry.action} by{" "}
                      {entry.actorEmail ?? "the system"}
                      {typeof entry.details.note === "string" ? (
                        <span className="block text-muted-foreground">“{entry.details.note}”</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:col-span-2">
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewForms
              orgId={review.id}
              status={review.status}
              domain={domain}
              defaultQuestion={defaultInfoRequest}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
