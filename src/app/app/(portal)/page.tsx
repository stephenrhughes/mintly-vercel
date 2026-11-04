import { ArrowRight, CircleCheck, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
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

  // A short checklist of next steps (NAV-20). Later phases add the key,
  // a first check, a team member and a billing contact.
  const steps = [
    {
      done: Boolean(membership),
      title: "Choose a plan",
      description: "Start a 14-day free trial of the Bank Account Checker. No card needed.",
      href: `${siteConfig.canonicalUrl}/pricing`,
      external: true,
    },
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

      {membership ? (
        <Card>
          <CardHeader>
            <CardTitle>{membership.orgName}</CardTitle>
            <CardDescription>{orgStatusLabel(membership.reviewStatus)}</CardDescription>
          </CardHeader>
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
              <a href={`${siteConfig.canonicalUrl}/pricing`} target="_blank" rel="noreferrer">
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
                {...(step.external ? { target: "_blank", rel: "noreferrer" } : {})}
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
