import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { AccountUnavailableNotice } from "@/components/app/pending-review-notice";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { findBuyer } from "@/lib/billing/checkout";
import { PLAN_INTENT_COOKIE, resolveIntent } from "@/lib/billing/plan-intent";
import { type BillingInterval, PLAN_TIERS, type PlanTier } from "@/lib/billing/plans";
import { getOrgSubscriptions } from "@/lib/billing/queries";
import { appPath } from "@/lib/hosts";
import { siteConfig } from "@/lib/site";
import { listActivePrices } from "@/lib/stripe/catalogue";
import { getStripe } from "@/lib/stripe/client";
import { availableIntervals } from "@/lib/stripe/prices";

import { PlanPicker } from "./plan-picker";

export const metadata: Metadata = { title: "Choose a plan" };

const title = "Choose a plan";

export default function SubscribePage(props: PageProps<"/app/subscribe">) {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Subscribe {...props} />
    </Suspense>
  );
}

// BUY-01 to BUY-05: choose a plan and go to Stripe Checkout.
async function Subscribe({ searchParams }: PageProps<"/app/subscribe">) {
  const [user, params, cookieStore] = await Promise.all([
    requireUser("/subscribe"),
    searchParams,
    cookies(),
  ]);
  const membership = user.membership;
  const contactHref = `mailto:${siteConfig.supportEmail}`;

  if (membership && membership.role !== "owner") {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Plans are chosen by your account owner</CardTitle>
            <CardDescription>
              {membership.orgName}&apos;s owner manages its subscription. Ask them if you need a
              different plan.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (membership?.reviewStatus === "rejected" || membership?.reviewStatus === "suspended") {
    // plan §6.11: a declined or suspended organisation can't check out.
    return (
      <Shell>
        <AccountUnavailableNotice suspended={membership.reviewStatus === "suspended"} />
      </Shell>
    );
  }

  const subscriptions = membership ? await getOrgSubscriptions(membership.orgId) : null;
  const live = subscriptions?.current.find((s) => s.product === "bank_checker" && !s.expired);
  if (live) {
    // BUY-05: the plan grid would only lead to the "already subscribed" refusal.
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>You already have a plan</CardTitle>
            <CardDescription>
              Change your plan, or start paying during a trial, without losing your API key.
            </CardDescription>
          </CardHeader>
          <CardFooter className="gap-3">
            <Button asChild>
              <a href={appPath("/subscription/change")}>Change plan</a>
            </Button>
            <Button asChild variant="outline">
              <a href={appPath("/subscription")}>View subscription</a>
            </Button>
          </CardFooter>
        </Card>
      </Shell>
    );
  }

  let availability: Record<PlanTier, BillingInterval[]> | null = null;
  let returning = Boolean(subscriptions?.hasHistory);
  if (getStripe()) {
    try {
      availability = availableIntervals(await listActivePrices(), PLAN_TIERS);
      returning ||= (await findBuyer(user)).kind === "returning";
    } catch (error) {
      console.error("loading the plan catalogue failed", error);
    }
  }

  return (
    <Shell
      description={
        returning
          ? "Pick the plan that suits your volume. You can change it later."
          : "Every plan starts with a 14-day free trial. No card needed."
      }
    >
      {availability === null ? (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Checkout isn&apos;t available on this deployment yet. Email {siteConfig.supportEmail} to
          get started.
        </p>
      ) : null}
      <PlanPicker
        intent={resolveIntent(params, cookieStore.get(PLAN_INTENT_COOKIE)?.value)}
        availability={availability}
        returning={returning}
        subscriptionHref={appPath("/subscription")}
        contactHref={contactHref}
      />
    </Shell>
  );
}

function Shell({ children, description }: { children: React.ReactNode; description?: string }) {
  return (
    <div className="grid gap-8">
      <PageHeader title={title} description={description} />
      {children}
    </div>
  );
}
