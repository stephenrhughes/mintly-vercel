import { ArrowRight, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";
import { siteConfig } from "@/lib/site";
import { getStripe } from "@/lib/stripe/client";

import { RefreshUntilReady } from "./refresh-until-ready";

export const metadata: Metadata = { title: "Welcome" };

const title = "Welcome to Mintly";

export default function WelcomePage(props: PageProps<"/app/welcome">) {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Welcome {...props} />
    </Suspense>
  );
}

/** Whether a Checkout session belongs to this user, so nobody can probe another's. */
async function ownsSession(sessionId: string, userId: string): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return false;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.client_reference_id === userId;
  } catch {
    return false;
  }
}

// BUY-06: where Stripe Checkout returns. The webhook provisions the account;
// this page waits for it, then sends the user on.
async function Welcome({ searchParams }: PageProps<"/app/welcome">) {
  const [user, params] = await Promise.all([requireUser("/welcome"), searchParams]);
  const sessionId = typeof params.session_id === "string" ? params.session_id : null;
  const membership = user.membership;

  if (!membership) {
    const valid = sessionId ? await ownsSession(sessionId, user.id) : false;
    return (
      <div className="grid gap-8">
        <PageHeader title={title} />
        <Card>
          <CardHeader>
            <CardTitle>{valid ? "Thanks for subscribing" : "No subscription yet"}</CardTitle>
            <CardDescription>
              {valid
                ? "We're setting up your account. This usually takes a few seconds."
                : "We couldn't find a completed checkout for your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {valid ? (
              <RefreshUntilReady supportEmail={siteConfig.supportEmail} />
            ) : (
              <Button asChild>
                <a href={appPath("/subscribe")}>Choose a plan</a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // The conversion events (a gtag conversion and GA successful_subscription)
  // are sent from here once analytics and consent arrive in phase 6.
  return (
    <div className="grid gap-8" data-conversion="subscription">
      <PageHeader title={title} description={`${membership.orgName} is ready.`} />
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleCheck className="size-5 text-primary" aria-hidden /> Your subscription has
            started
          </CardTitle>
          <CardDescription>
            Your API key is on the subscription page. Keep it secret: anyone with it can use your
            plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={appPath("/subscription")}>
              Get your API key <ArrowRight />
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={appPath("/")}>Go to overview</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
