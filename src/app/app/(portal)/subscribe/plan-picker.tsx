"use client";

import { Check, CircleAlert } from "lucide-react";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { useBfcacheReset } from "@/components/forms/use-bfcache-reset";
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
import type { PlanIntent } from "@/lib/billing/plan-intent";
import { type BillingInterval, PLAN_TIERS, PLANS, type PlanTier } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

import { type CheckoutState, startCheckout } from "./actions";

type Props = {
  intent: PlanIntent | null;
  /** Intervals Stripe sells for each tier, or null when Stripe isn't configured. */
  availability: Record<PlanTier, BillingInterval[]> | null;
  /** A returning customer gets no trial (BUY-04, SUB-06). */
  returning: boolean;
  subscriptionHref: string;
  contactHref: string;
};

const formatDate = (seconds: number | null) =>
  seconds
    ? new Date(seconds * 1000).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

// BUY-01, BUY-02: the plan grid, with a confirm panel for a plan picked on
// the pricing page.
export function PlanPicker({
  intent,
  availability,
  returning,
  subscriptionHref,
  contactHref,
}: Props) {
  const [state, action] = useActionState<CheckoutState, FormData>(startCheckout, {});
  const [interval, setBillingInterval] = useState<BillingInterval>(intent?.interval ?? "monthly");
  const generation = useBfcacheReset();
  const cta = returning ? "Choose this plan" : "Start free trial";

  const sells = (tier: PlanTier, wanted: BillingInterval) =>
    availability === null || availability[tier].includes(wanted);

  return (
    <div className="grid gap-8" key={generation}>
      {state.error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.blocked ? (
        // BUY-05: never a second subscription by accident.
        <Alert>
          <CircleAlert aria-hidden />
          <AlertTitle>You already have a plan</AlertTitle>
          <AlertDescription>
            <p>
              Your {state.blocked.planName ?? "subscription"} is{" "}
              {state.blocked.status === "trialing"
                ? "on a free trial"
                : state.blocked.status.replace("_", " ")}
              {state.blocked.status === "trialing" && formatDate(state.blocked.trialEnd)
                ? ` until ${formatDate(state.blocked.trialEnd)}`
                : formatDate(state.blocked.currentPeriodEnd)
                  ? `, renewing on ${formatDate(state.blocked.currentPeriodEnd)}`
                  : ""}
              . Starting another would charge you twice, so we haven&apos;t.
            </p>
            <p className="mt-2">
              Changing plan yourself is coming soon. Until then,{" "}
              <a className="font-medium underline" href={contactHref}>
                contact us
              </a>{" "}
              and we&apos;ll change it for you.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <a href={subscriptionHref}>View your subscription</a>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {intent && sells(intent.tier, intent.interval) ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardDescription>You chose</CardDescription>
            <CardTitle className="text-xl">{PLANS[intent.tier].name}</CardTitle>
            <CardDescription>
              {intent.interval === "annual"
                ? `${PLANS[intent.tier].annualPrice} a year`
                : `${PLANS[intent.tier].monthlyPrice} a month`}
              , {PLANS[intent.tier].includedRequests} checks a month,{" "}
              {PLANS[intent.tier].includedUsers.toLowerCase()}.
              {returning ? "" : " Free for 14 days, no card needed."}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <form action={action}>
              <input type="hidden" name="tier" value={intent.tier} />
              <input type="hidden" name="interval" value={intent.interval} />
              <SubmitButton pendingLabel="Opening checkout…" disabled={availability === null}>
                {returning ? "Confirm this plan" : "Confirm and start free trial"}
              </SubmitButton>
            </form>
          </CardFooter>
        </Card>
      ) : null}

      <section aria-labelledby="plans-heading" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="plans-heading" className="text-lg font-semibold">
            {intent ? "Or choose another plan" : "Plans"}
          </h2>
          <div
            role="radiogroup"
            aria-label="Billing period"
            className="inline-flex rounded-md border bg-background p-0.5"
          >
            {(["monthly", "annual"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={interval === value}
                onClick={() => setBillingInterval(value)}
                className={cn(
                  "rounded px-3 py-1 text-sm font-medium",
                  interval === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {value === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_TIERS.map((tier) => {
            const plan = PLANS[tier];
            const available = sells(tier, interval);
            return (
              <Card key={tier} className={cn(tier === "standardPlus" && "border-primary/40")}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{plan.name}</CardTitle>
                    {tier === "standardPlus" ? <Badge>Popular</Badge> : null}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <p>
                    <span className="text-3xl font-semibold">
                      {interval === "annual" ? plan.annualPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {interval === "annual" ? " a year" : " a month"} + VAT
                    </span>
                  </p>
                  <ul className="grid gap-1.5 text-sm">
                    {[
                      `${plan.includedRequests} checks a month`,
                      plan.includedUsers,
                      `${plan.pricePerRequest} per extra check`,
                      `${plan.throttle} requests a second`,
                    ].map((line) => (
                      <li key={line} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        {line}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="mt-auto">
                  <form action={action} className="w-full">
                    <input type="hidden" name="tier" value={tier} />
                    <input type="hidden" name="interval" value={interval} />
                    <SubmitButton
                      className="w-full"
                      variant={tier === "standardPlus" ? "default" : "outline"}
                      pendingLabel="Opening checkout…"
                      disabled={!available || availability === null}
                    >
                      {available ? cta : interval === "annual" ? "Monthly only" : "Annual only"}
                    </SubmitButton>
                  </form>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Need more than 50,000 checks a month?</CardTitle>
          <CardDescription>
            Enterprise plans have volume pricing, unlimited users and a named contact.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <a href={contactHref}>Talk to us</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
