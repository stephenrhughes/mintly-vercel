import { CircleAlert, Download, ExternalLink, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type AppUser, requireUser } from "@/lib/auth/session";
import { canManageBilling, canSeeKey } from "@/lib/billing/permissions";
import { getOrgSubscriptions, planNameFor } from "@/lib/billing/queries";
import { seatLimit } from "@/lib/billing/seats";
import {
  describeSubscription,
  showKeyNotice,
  type StatusTone,
  type SubscriptionView,
} from "@/lib/billing/status";
import { appPath } from "@/lib/hosts";
import { siteConfig } from "@/lib/site";

import { dismissKeyNotice } from "./actions";
import { ApiKey } from "./api-key";
import { BillingPortalButton } from "./billing-portal-button";

export const metadata: Metadata = { title: "Subscription" };

const title = "Subscription";

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Subscription />
    </Suspense>
  );
}

const toneVariant: Record<StatusTone, "default" | "secondary" | "outline"> = {
  good: "default",
  warning: "secondary",
  inactive: "outline",
};

// SUB-01 to SUB-06, BILL-01, BILL-02, BILL-08: the plan, its status, the API
// key for owners and developers, and billing for the owner.
async function Subscription() {
  const user = await requireUser("/subscription");
  const membership = user.membership;

  if (!membership) {
    return (
      <div className="grid gap-8">
        <PageHeader title={title} />
        <Card>
          <CardHeader>
            <CardTitle>No plan yet</CardTitle>
            <CardDescription>
              Start a 14-day free trial to get an API key and use the web tools.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <a href={appPath("/subscribe")}>Choose a plan</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const { current } = await getOrgSubscriptions(membership.orgId);
  const names = await Promise.all(current.map((sub) => planNameFor(sub.stripePriceId)));
  const bankChecker = current.find((sub) => sub.product === "bank_checker");
  const ownerCanResubscribe = membership.role === "owner" && (!bankChecker || bankChecker.expired);

  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        description={`${membership.orgName}'s plan and API key.`}
        action={canManageBilling(membership) && current.length > 0 ? <BillingPortalButton /> : null}
      />

      {current.some(showKeyNotice) && canSeeKey(membership) ? (
        // BILL-08: a returning customer's key has changed.
        <Alert>
          <KeyRound aria-hidden />
          <AlertTitle>You have a new API key</AlertTitle>
          <AlertDescription>
            <p>
              Your previous key stopped working when your last subscription ended. Update your
              integrations with the key below.
            </p>
            <form action={dismissKeyNotice} className="mt-2">
              <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
                I&apos;ve updated my integrations
              </SubmitButton>
            </form>
          </AlertDescription>
        </Alert>
      ) : null}

      {current.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No subscription found</CardTitle>
            <CardDescription>
              Your organisation has no subscription yet. If you&apos;ve just checked out, it will
              appear in a few seconds.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        current.map((sub, index) => (
          <SubscriptionCard key={sub.id} sub={sub} name={names[index]} user={user} />
        ))
      )}

      {ownerCanResubscribe && current.length > 0 ? (
        // SUB-06: a returning customer chooses a plan again (no trial).
        <Card>
          <CardHeader>
            <CardTitle>Subscribe again</CardTitle>
            <CardDescription>
              Choose a plan to start using Mintly again. You&apos;ll get a new API key.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <a href={appPath("/subscribe")}>Choose a plan</a>
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      <Resources />

      {membership.role === "owner" ? <BillingTerms /> : null}
    </div>
  );
}

function SubscriptionCard({
  sub,
  name,
  user,
}: {
  sub: SubscriptionView;
  name: string;
  user: AppUser;
}) {
  const membership = user.membership!;
  const status = describeSubscription(sub, {
    pendingReview: membership.reviewStatus === "pending_review",
  });
  const seats = seatLimit({ maxTeamSize: sub.maxTeamSize, extraUsers: sub.extraUsers });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">{name}</CardTitle>
          <Badge variant={toneVariant[status.tone]}>{status.label}</Badge>
        </div>
        <CardDescription>
          {[status.dateLine, seats ? `${seats} ${seats === 1 ? "seat" : "seats"}` : null]
            .filter(Boolean)
            .join(" · ")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <section
          id={sub.product === "bank_checker" ? "api-key" : `api-key-${sub.product}`}
          aria-labelledby={`key-${sub.id}`}
          className="grid gap-3"
        >
          <h3 id={`key-${sub.id}`} className="font-medium">
            API key
          </h3>
          <KeySection sub={sub} active={status.active} membership={membership} />
        </section>
      </CardContent>
    </Card>
  );
}

function KeySection({
  sub,
  active,
  membership,
}: {
  sub: SubscriptionView;
  active: boolean;
  membership: NonNullable<AppUser["membership"]>;
}) {
  if (membership.role === "member") {
    return (
      <p className="text-sm text-muted-foreground">
        Your organisation&apos;s owner and developers manage the API key. The web tools use it for
        you.
      </p>
    );
  }
  if (membership.reviewStatus === "pending_review") {
    return (
      <p className="text-sm text-muted-foreground">
        Your key will appear here once we&apos;ve approved your account. This usually takes less
        than one working day.
      </p>
    );
  }
  if (!canSeeKey(membership)) {
    return (
      <p className="text-sm text-muted-foreground">
        Your API key is turned off. Email {siteConfig.supportEmail} for help.
      </p>
    );
  }
  if (!active) {
    return (
      <p className="text-sm text-muted-foreground">
        {sub.expired
          ? "This subscription has ended, so its key no longer works."
          : "Your key isn't ready yet. If you've just subscribed, refresh in a few seconds."}
      </p>
    );
  }
  return (
    <>
      <ApiKey />
      <Alert>
        <CircleAlert aria-hidden />
        <AlertDescription>
          Keep your key secret. Store it in a secrets manager, never in code or a browser, and send
          it in the <code>x-api-key</code> header. If it leaks, email {siteConfig.supportEmail} and
          we&apos;ll replace it.
        </AlertDescription>
      </Alert>
    </>
  );
}

// SUB-04: developer resources.
function Resources() {
  const links = [
    { label: "API documentation", href: `${siteConfig.canonicalUrl}/docs`, icon: ExternalLink },
    {
      label: "Postman collection",
      href: `${siteConfig.canonicalUrl}/assets/docs/Mintly-API.postman_collection.json`,
      icon: Download,
    },
    {
      label: "Integration guides",
      href: `${siteConfig.canonicalUrl}/integration-guides`,
      icon: ExternalLink,
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Build your integration</CardTitle>
        <CardDescription>
          Production: <code>{siteConfig.apiBaseUrl}/bankAccount/v1</code>. Try it first against the
          sandbox, <code>{siteConfig.sandboxBaseUrl}/bankAccount/v1</code>, which returns fixed test
          values.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex flex-wrap gap-3">
        {links.map(({ label, href, icon: Icon }) => (
          <Button key={label} asChild variant="outline" size="sm">
            <a href={href} target="_blank" rel="noreferrer">
              <Icon aria-hidden /> {label}
            </a>
          </Button>
        ))}
      </CardFooter>
    </Card>
  );
}

// BILL-02: the billing terms, for the owner.
function BillingTerms() {
  return (
    <section aria-labelledby="billing-terms" className="grid gap-2 text-sm text-muted-foreground">
      <h2 id="billing-terms" className="font-medium text-foreground">
        Billing terms
      </h2>
      <p>
        Plans are billed monthly in arrears, or yearly for annual plans. Checks above your
        plan&apos;s allowance are charged at its overage rate. Cancelling stops the next renewal but
        doesn&apos;t refund the current period.
      </p>
      <p>
        To change plan or end a trial early, email {siteConfig.supportEmail}. Changing plan yourself
        is coming soon.
      </p>
    </section>
  );
}
