import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
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
import { requirePortalViewer } from "@/lib/auth/session";
import { type ChangeRequest, classifyChange, recommendPlan } from "@/lib/billing/change-plan";
import { longDate, money } from "@/lib/billing/format";
import { canManageBilling } from "@/lib/billing/permissions";
import { planNameFor } from "@/lib/billing/queries";
import { type ChangeContext, quoteChange } from "@/lib/billing/plan-change";
import {
  loadChangeContext,
  planChangeDeps,
  supabasePlanChangeRecords,
} from "@/lib/billing/plan-change-server";
import {
  type BillingInterval,
  isBillingInterval,
  isPlanTier,
  PLAN_TIERS,
  PLANS,
  type PlanTier,
} from "@/lib/billing/plans";
import { appPath } from "@/lib/hosts";
import { siteConfig } from "@/lib/site";
import { getStripe } from "@/lib/stripe/client";
import { cn } from "@/lib/utils";

import { cancelPlanChange } from "./actions";
import { ConfirmForm } from "./confirm-form";

export const metadata: Metadata = { title: "Change plan" };

const title = "Change plan";

export default function ChangePlanPage(props: PageProps<"/app/subscription/change">) {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <ChangePlan {...props} />
    </Suspense>
  );
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const intervalWord = (interval: BillingInterval) => (interval === "annual" ? "year" : "month");
const billed = (interval: BillingInterval) => (interval === "annual" ? "annually" : "monthly");

function Shell({ children, description }: { children: React.ReactNode; description?: string }) {
  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        description={description}
        action={
          <Link
            href={appPath("/subscription")}
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to subscription
          </Link>
        }
      />
      {children}
    </div>
  );
}

function Message({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
    </Card>
  );
}

// plan §6.12, PLAN-01 to PLAN-07: the owner changes plan themselves.
async function ChangePlan({ searchParams }: PageProps<"/app/subscription/change">) {
  const [user, params] = await Promise.all([
    requirePortalViewer("/subscription/change"),
    searchParams,
  ]);
  const membership = user.membership;
  const contact = `mailto:${siteConfig.supportEmail}`;

  if (!canManageBilling(membership)) {
    return (
      <Shell>
        <Message heading="Plans are changed by your account owner">
          Ask your organisation&apos;s owner if you need a different plan.
        </Message>
      </Shell>
    );
  }
  if (!getStripe()) {
    return (
      <Shell>
        <Message heading="Changing plan isn't available here yet">
          Email {siteConfig.supportEmail} to change your plan.
        </Message>
      </Shell>
    );
  }

  const ctx = await loadChangeContext(membership!.orgId);
  if (!ctx) {
    return (
      <Shell>
        <Message heading="No live subscription">
          <Link href={appPath("/subscribe")} className="font-medium text-primary hover:underline">
            Choose a plan
          </Link>{" "}
          to start one.
        </Message>
      </Shell>
    );
  }

  const current = ctx.current;
  if (current.custom) {
    // PLAN-10: custom prices are changed by Mintly.
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Your plan was set up for you</CardTitle>
            <CardDescription>Contact us and we&apos;ll change it.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <a href={contact}>Contact us</a>
            </Button>
          </CardFooter>
        </Card>
      </Shell>
    );
  }

  const deps = planChangeDeps();
  const scheduled = await supabasePlanChangeRecords().scheduled(ctx.orgId);
  const mode: ChangeRequest["mode"] =
    current.trialing && first(params.mode) === "start_paid" ? "start_paid" : "switch";
  const intervalParam = first(params.interval);
  const interval: BillingInterval = isBillingInterval(intervalParam)
    ? intervalParam
    : (current.interval ?? "monthly");
  const tierParam = first(params.tier);
  const selected: PlanTier | null = isPlanTier(tierParam) ? tierParam : null;
  const recommendation = recommendPlan({
    seatsUsed: ctx.team.seatsUsed,
    monthlyChecks: ctx.monthlyChecks,
  });
  const card = first(params.card);

  const href = (query: Record<string, string>) =>
    appPath(`/subscription/change?${new URLSearchParams({ mode, interval, ...query }).toString()}`);

  const currentName = current.tier ? PLANS[current.tier].name : "a legacy plan";
  const description = current.trialing
    ? `You're trialling the ${current.tier ? PLANS[current.tier].name : "Bank Account Checker"}. Your API key stays the same whatever you choose.`
    : `You're on ${current.tier ? "the " : ""}${currentName}${current.interval ? `, billed ${billed(current.interval)}` : ""}. Your API key stays the same whatever you choose.`;

  return (
    <Shell description={description}>
      {card === "added" ? (
        <Alert variant="success">
          <CircleCheck aria-hidden />
          <AlertDescription className="text-secondary-foreground">
            Your card has been added. Check the amounts and confirm.
          </AlertDescription>
        </Alert>
      ) : null}
      {card === "failed" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>We couldn&apos;t use that card. Try adding it again.</AlertDescription>
        </Alert>
      ) : null}

      {scheduled ? (
        <ScheduledNotice
          name={await planNameFor(scheduled.toPriceId)}
          effectiveAt={scheduled.effectiveAt}
        />
      ) : null}

      {current.trialing ? (
        <nav aria-label="What to do with your trial" className="flex flex-wrap gap-2">
          <Button asChild variant={mode === "switch" ? "default" : "outline"} size="sm">
            <Link href={appPath(`/subscription/change?mode=switch&interval=${interval}`)}>
              Switch plan and keep my trial
            </Link>
          </Button>
          <Button asChild variant={mode === "start_paid" ? "default" : "outline"} size="sm">
            <Link href={appPath(`/subscription/change?mode=start_paid&interval=${interval}`)}>
              Start paying now
            </Link>
          </Button>
        </nav>
      ) : null}

      {mode === "start_paid" && current.reviewStatus !== "approved" ? (
        <Message heading="Starting a paid plan comes after approval">
          You can switch plan during your trial now, and start paying once we&apos;ve approved your
          account.
        </Message>
      ) : null}

      <section aria-labelledby="plans-heading" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="plans-heading" className="text-lg font-semibold">
              Plans
            </h2>
            {recommendation.tier ? (
              <p className="text-sm text-muted-foreground">Recommended: {recommendation.reason}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
            )}
          </div>
          <nav
            aria-label="Billing period"
            className="inline-flex rounded-md border bg-background p-0.5"
          >
            {(["monthly", "annual"] as const).map((value) => (
              <Link
                key={value}
                href={href({ interval: value, ...(selected ? { tier: selected } : {}) })}
                aria-current={interval === value ? "true" : undefined}
                className={cn(
                  "rounded px-3 py-1 text-sm font-medium",
                  interval === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {value === "monthly" ? "Monthly" : "Annual"}
              </Link>
            ))}
          </nav>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_TIERS.map((tier) => {
            const plan = PLANS[tier];
            const isCurrent = current.tier === tier && current.interval === interval;
            const check = classifyChange(current, { tier, interval, mode }, ctx.team, {
              monthlyChecks: ctx.monthlyChecks,
            });
            return (
              <Card
                key={tier}
                className={cn(selected === tier && "border-primary ring-1 ring-primary")}
              >
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{plan.name}</CardTitle>
                    {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                    {recommendation.tier === tier && !isCurrent ? <Badge>Recommended</Badge> : null}
                  </div>
                  <CardDescription>
                    {interval === "annual" ? plan.annualPrice : plan.monthlyPrice} a{" "}
                    {intervalWord(interval)} + VAT
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-1 text-sm">
                  <p>{plan.includedRequests} checks a month</p>
                  <p>{plan.includedUsers}</p>
                  <p className="text-muted-foreground">{plan.pricePerRequest} per extra check</p>
                </CardContent>
                <CardFooter className="mt-auto">
                  {check.allowed ? (
                    <Button
                      asChild
                      variant={selected === tier ? "default" : "outline"}
                      className="w-full"
                    >
                      <Link href={href({ tier })}>
                        {mode === "start_paid" && isCurrent
                          ? "Start paying for this plan"
                          : "Choose"}
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">{check.message}</p>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      {selected ? (
        <QuotePanel deps={deps} ctx={ctx} request={{ tier: selected, interval, mode }} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Need more than 50,000 checks a month, or more seats?</CardTitle>
          <CardDescription>Talk to us about volume pricing or extra seats.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <a href={contact}>Talk to us</a>
          </Button>
        </CardFooter>
      </Card>
    </Shell>
  );
}

function ScheduledNotice({ name, effectiveAt }: { name: string; effectiveAt: Date }) {
  return (
    <Alert>
      <TriangleAlert aria-hidden />
      <AlertTitle>Your plan changes on {longDate(effectiveAt)}</AlertTitle>
      <AlertDescription>
        <p>You&apos;ll move to the {name} then. Until that date nothing changes.</p>
        <form action={cancelPlanChange} className="mt-2">
          <SubmitButton size="sm" variant="outline" pendingLabel="Cancelling…">
            Cancel this change
          </SubmitButton>
        </form>
      </AlertDescription>
    </Alert>
  );
}

async function QuotePanel({
  deps,
  ctx,
  request,
}: {
  deps: ReturnType<typeof planChangeDeps>;
  ctx: ChangeContext;
  request: ChangeRequest;
}) {
  let result;
  try {
    result = await quoteChange(deps, ctx, request);
  } catch (error) {
    console.error("quoting a plan change failed", error);
    return <Message heading="We couldn't price that change">Please try again in a moment.</Message>;
  }
  if (!result.ok) {
    return (
      <Message heading="That change isn't available">
        {"classification" in result ? result.classification.message : result.error}
      </Message>
    );
  }

  const q = result.quote;
  const then = `${money(q.then.amount, q.currency)} + VAT a ${intervalWord(q.then.interval)}`;
  const summary: Record<typeof q.kind, { today: string; after: string; button: string }> = {
    trial_switch: {
      today: "Nothing. Your trial carries on with the same end date.",
      after: `When your trial ends on ${longDate(q.then.from)}: ${then}, if you've added a card by then.`,
      button: `Switch my trial to the ${q.planName}`,
    },
    start_paid: {
      today: `${money(q.today, q.currency)} including VAT. Your trial ends now.`,
      after: `Then ${then}, next on ${longDate(q.then.from)}.`,
      button: `Start the ${q.planName} and pay ${money(q.today, q.currency)}`,
    },
    upgrade: {
      today: `${money(q.today, q.currency)} including VAT: the difference for the rest of this billing period, less what's left of your current plan.`,
      after: `Then ${then}, next on ${longDate(q.then.from)}.`,
      button: `Upgrade and pay ${money(q.today, q.currency)}`,
    },
    downgrade_scheduled: {
      today:
        "Nothing, and no refund. Your current plan carries on until the end of this billing period.",
      after: `From ${longDate(q.then.from)}: ${then}.`,
      button: `Change to the ${q.planName} on ${longDate(q.then.from)}`,
    },
  };
  const s = summary[q.kind];

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>
          {q.planName}, billed {billed(request.interval)}
        </CardTitle>
        <CardDescription>What happens if you confirm:</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="font-medium">Charged today</dt>
            <dd className="text-muted-foreground">{s.today}</dd>
          </div>
          <div>
            <dt className="font-medium">After that</dt>
            <dd className="text-muted-foreground">{s.after}</dd>
          </div>
        </dl>
        {q.warnings.map((warning) => (
          <Alert key={warning}>
            <TriangleAlert aria-hidden />
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        ))}
        <ConfirmForm
          tier={request.tier}
          interval={request.interval}
          mode={request.mode}
          prorationDate={q.prorationDate}
          nonce={randomUUID()}
          label={s.button}
        />
      </CardContent>
    </Card>
  );
}
