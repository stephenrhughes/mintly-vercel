import { ArrowRight, CircleCheck, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { TrialEndingBanner, trialEndsSoon } from "@/components/app/trial-ending-banner";
import {
  AccountUnavailableNotice,
  PendingReviewNotice,
} from "@/components/app/pending-review-notice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/session";
import { canSeeKey } from "@/lib/billing/permissions";
import { getOrgSubscriptions, planNameFor } from "@/lib/billing/queries";
import { describeSubscription } from "@/lib/billing/status";
import { appPath } from "@/lib/hosts";
import { orgStatusLabel } from "@/lib/nav";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage(props: PageProps<"/app">) {
  return (
    <Suspense fallback={<PageHeader title="Overview" />}>
      <Overview {...props} />
    </Suspense>
  );
}

async function Overview({ searchParams }: PageProps<"/app">) {
  const [user, params] = await Promise.all([requireUser("/"), searchParams]);
  const membership = user.membership;
  const subscriptions = membership ? await getOrgSubscriptions(membership.orgId) : null;
  const sub =
    subscriptions?.current.find((s) => s.product === "bank_checker") ?? subscriptions?.current[0];
  const status = sub
    ? describeSubscription(sub, { pendingReview: membership?.reviewStatus === "pending_review" })
    : null;
  const planName = sub ? await planNameFor(sub.stripePriceId) : null;

  // A short checklist of next steps (NAV-20). Later phases add a first
  // check, a team member and a billing contact.
  const steps = [
    {
      done: Boolean(sub && !sub.expired),
      title: "Choose a plan",
      description: "Start a 14-day free trial of the Bank Account Checker. No card needed.",
      href: appPath("/subscribe"),
    },
    ...(canSeeKey(membership)
      ? [
          {
            done: Boolean(status?.active),
            title: "Get your API key",
            description: "Copy your key from the subscription page and make your first call.",
            href: appPath("/subscription#api-key"),
          },
        ]
      : []),
    {
      done: Boolean(user.firstName && user.lastName && user.companyName),
      title: "Complete your profile",
      description: "Add your name and company so we know who we're talking to.",
      href: appPath("/account"),
    },
    {
      done: user.hasMfa,
      title: "Turn on two-step verification",
      description: "Protect your account with an authenticator app.",
      href: appPath("/account/security"),
    },
  ];

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Overview"
        description={user.firstName ? `Welcome, ${user.firstName}.` : "Welcome to Mintly."}
      />

      {params.password === "updated" ? (
        <Alert variant="success">
          <CircleCheck aria-hidden />
          <AlertDescription className="text-secondary-foreground">
            Your password has been changed.
          </AlertDescription>
        </Alert>
      ) : null}

      {membership?.reviewStatus === "pending_review" ? (
        <PendingReviewNotice orgName={membership.orgName} />
      ) : null}
      {membership?.reviewStatus === "approved" &&
      sub?.trialing &&
      !sub.expired &&
      trialEndsSoon(sub.trialEnd) &&
      sub.trialEnd ? (
        <TrialEndingBanner
          trialEnd={sub.trialEnd}
          isOwner={membership.role === "owner"}
          changePlanHref={appPath("/subscription/change")}
        />
      ) : null}
      {membership?.reviewStatus === "rejected" || membership?.reviewStatus === "suspended" ? (
        <AccountUnavailableNotice suspended={membership.reviewStatus === "suspended"} />
      ) : null}

      {membership ? (
        <Card>
          <CardHeader>
            <CardTitle>{membership.orgName}</CardTitle>
            <CardDescription>{orgStatusLabel(membership.reviewStatus)}</CardDescription>
          </CardHeader>
          {sub && status ? (
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {planName}{" "}
                  <Badge variant={status.active ? "default" : "outline"}>{status.label}</Badge>
                </p>
                {status.dateLine ? (
                  <p className="text-sm text-muted-foreground">{status.dateLine}</p>
                ) : null}
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={appPath("/subscription")}>View subscription</a>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        // ACC-05, NAV-18: nothing is a dead end without a subscription.
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Choose a plan</CardTitle>
            <CardDescription>
              Your account is not linked to an active subscription yet. Start a free trial to get an
              API key and use the web tools, or talk to us about the EISCD data file.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <a href={appPath("/subscribe")}>
                See plans <ArrowRight />
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`mailto:${siteConfig.supportEmail}`}>Talk to us</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="next-steps">
        <h2 id="next-steps" className="text-lg font-semibold">
          Next steps
        </h2>
        <ol className="mt-3 grid gap-2">
          {steps.map((step) => (
            <li key={step.title}>
              <Link
                href={step.href}
                className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:border-primary/40"
              >
                {step.done ? (
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span>
                  <span
                    className={
                      step.done ? "font-medium text-muted-foreground line-through" : "font-medium"
                    }
                  >
                    {step.title}
                  </span>
                  <span className="sr-only">{step.done ? " (done)" : ""}</span>
                  <span className="block text-sm text-muted-foreground">{step.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
