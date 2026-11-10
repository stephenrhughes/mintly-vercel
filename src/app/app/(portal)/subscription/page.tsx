import {
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Download,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { TrialEndingBanner, trialEndsSoon } from "@/components/app/trial-ending-banner";
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
import { longDate } from "@/lib/billing/format";
import { getOrgSubscriptions, planNameFor } from "@/lib/billing/queries";
import { createClient } from "@/lib/supabase/server";
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
import { cancelPlanChange } from "./change/actions";
import { RotateKeyForm } from "./rotate-key-form";
import { ApiKey } from "./api-key";
import { BillingPortalButton } from "./billing-portal-button";

export const metadata: Metadata = { title: "Subscription" };

const title = "Subscription";

export default function SubscriptionPage(props: PageProps<"/app/subscription">) {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Subscription {...props} />
    </Suspense>
  );
}

// After a plan change (plan §6.12) the owner lands back here.
const changedText: Record<string, string> = {
  trial_switch: "Your trial is now on your new plan. Your trial end date hasn't changed.",
  start_paid: "Your paid plan has started. Thank you!",
  upgrade: "Your plan has been upgraded.",
  downgrade_scheduled: "Your plan will change at the end of this billing period.",
  cancelled: "The scheduled change is cancelled. Your plan stays as it is.",
};

const toneVariant: Record<StatusTone, "default" | "secondary" | "outline"> = {
  good: "default",
  warning: "secondary",
  inactive: "outline",
};

// SUB-01 to SUB-06, BILL-01, BILL-02, BILL-08: the plan, its status, the API
// key for owners and developers, and billing for the owner.
async function Subscription({ searchParams }: PageProps<"/app/subscription">) {
  const [user, params] = await Promise.all([requireUser("/subscription"), searchParams]);
  const membership = user.membership;
  const changed = typeof params.changed === "string" ? changedText[params.changed] : undefined;

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
  const scheduled = membership.role === "owner" ? await scheduledChange(membership.orgId) : null;
  const showTrialBanner =
    bankChecker?.trialing &&
    !bankChecker.expired &&
    membership.reviewStatus === "approved" &&
    trialEndsSoon(bankChecker.trialEnd);

  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        description={`${membership.orgName}'s plan and API key.`}
        action={canManageBilling(membership) && current.length > 0 ? <BillingPortalButton /> : null}
      />

      {changed ? (
        <Alert variant="success">
          <CircleCheck aria-hidden />
          <AlertDescription className="text-secondary-foreground">{changed}</AlertDescription>
        </Alert>
      ) : null}

      {showTrialBanner && bankChecker?.trialEnd ? (
        <TrialEndingBanner
          trialEnd={bankChecker.trialEnd}
          isOwner={membership.role === "owner"}
          changePlanHref={appPath("/subscription/change")}
        />
      ) : null}

      {scheduled ? (
        // PLAN-04: a downgrade waits for the end of the period, and can be cancelled.
        <Alert>
          <CalendarClock aria-hidden />
          <AlertTitle>
            Your plan changes to the {scheduled.planName} on {longDate(scheduled.effectiveAt)}
          </AlertTitle>
          <AlertDescription>
            <form action={cancelPlanChange} className="mt-1">
              <SubmitButton size="sm" variant="outline" pendingLabel="Cancelling…">
                Cancel this change
              </SubmitButton>
            </form>
          </AlertDescription>
        </Alert>
      ) : null}

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

async function scheduledChange(orgId: string) {
  // Owners read their organisation's plan changes through RLS.
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_changes")
    .select("to_price_id, effective_at")
    .eq("org_id", orgId)
    .eq("status", "scheduled")
    .maybeSingle<{ to_price_id: string; effective_at: string }>();
  if (!data) return null;
  return {
    planName: await planNameFor(data.to_price_id),
    effectiveAt: new Date(data.effective_at),
  };
}

/** A key from a rotation that still works for a while (KEY-01). */
async function retiringKey(orgId: string): Promise<Date | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("api_keys")
    .select("retire_at")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .gt("retire_at", new Date().toISOString())
    .order("retire_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ retire_at: string }>();
  return data ? new Date(data.retire_at) : null;
}

async function SubscriptionCard({
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
          <KeySection
            sub={sub}
            active={status.active}
            membership={membership}
            retiringUntil={status.active ? await retiringKey(membership.orgId) : null}
          />
        </section>
      </CardContent>
      {canManageBilling(membership) && sub.product === "bank_checker" && !sub.expired ? (
        // PLAN-01: the owner changes plan themselves.
        <CardFooter className="border-t">
          <Button asChild variant="outline">
            <a href={appPath("/subscription/change")}>
              {sub.trialing ? "Change plan or start paying" : "Change plan"}
            </a>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function KeySection({
  sub,
  active,
  membership,
  retiringUntil,
}: {
  sub: SubscriptionView;
  active: boolean;
  membership: NonNullable<AppUser["membership"]>;
  retiringUntil: Date | null;
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
      {retiringUntil ? (
        <p className="text-sm text-muted-foreground">
          Your previous key keeps working until{" "}
          {retiringUntil.toLocaleString("en-GB", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Europe/London",
          })}
          .
        </p>
      ) : null}
      <Alert>
        <CircleAlert aria-hidden />
        <AlertDescription>
          Keep your key secret. Store it in a secrets manager, never in code or a browser, and send
          it in the <code>x-api-key</code> header. If it leaks, rotate it below.
        </AlertDescription>
      </Alert>
      <RotateKeyForm />
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
        Upgrades take effect straight away and are charged for the rest of the billing period, less
        what&apos;s left of your current plan. Downgrades take effect at the end of the period, with
        no refund.
      </p>
    </section>
  );
}
