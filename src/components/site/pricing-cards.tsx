"use client";

import { Building2, CirclePlus, Rocket } from "lucide-react";
import { useState } from "react";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { CheckList } from "@/components/site/check-list";
import { openChat } from "@/components/site/chat";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { type BillingInterval, PLANS, type PlanTier } from "@/lib/billing/plans";
import { salesToAppHref } from "@/lib/hosts";
import { cn } from "@/lib/utils";

// The plan cards on /pricing (BUY-01, ported from Products.js and
// PriceCard.js). Choosing a plan goes to the app's /subscribe with the plan
// in the URL, which survives sign-up (BUY-02); the app decides whether the
// visitor is new, returning or already subscribed.
const cards: { tier: PlanTier; icon: typeof Rocket; badge?: string; onboarding?: boolean }[] = [
  { tier: "professional", icon: Building2, badge: "Best value", onboarding: true },
  { tier: "standardPlus", icon: CirclePlus, onboarding: true },
  { tier: "starter", icon: Rocket },
];

export function PricingCards() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const monthly = interval === "monthly";

  return (
    <div>
      <div className="flex justify-center">
        <div
          className="inline-flex rounded-lg bg-muted p-1"
          role="group"
          aria-label="Billing period"
        >
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium",
                interval === value ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {value === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {cards.map(({ tier, icon: Icon, badge, onboarding }) => {
          const plan = PLANS[tier];
          const href = salesToAppHref(
            `/subscribe?plan=${tier}${monthly ? "" : "&interval=annual"}`,
          );
          return (
            <div
              key={tier}
              className={cn(
                "relative flex flex-col rounded-xl border bg-card p-6 shadow-sm",
                badge && "border-primary ring-2 ring-primary/20",
              )}
            >
              {badge && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                  {badge}
                </span>
              )}
              <div className="flex items-center gap-3">
                <Icon className="size-6 text-primary" aria-hidden />
                <h3 className="text-xl font-semibold">{plan.name}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-5 text-4xl font-semibold">
                {monthly ? plan.monthlyPrice : plan.annualPrice}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  {monthly ? "/mth" : "/year"}
                </span>
              </p>
              <Button asChild className="mt-5">
                <a href={href} onClick={() => track("select_plan", { plan: tier, interval })}>
                  Try for free
                </a>
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                No payment required to start.
              </p>
              <p className="mt-6 text-sm font-semibold">What you get:</p>
              <CheckList
                className="mt-3 text-sm"
                items={[
                  <>
                    <strong>
                      <i>{plan.includedRequests} free</i>
                    </strong>{" "}
                    requests /month
                  </>,
                  <>
                    then <strong>{plan.pricePerRequest}</strong> per request*
                  </>,
                  `Up to ${plan.throttle} requests /sec`,
                  plan.includedUsers,
                  ...(onboarding ? ["Unlimited help to onboard"] : []),
                ]}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="font-medium">Need 50,000 checks per month or more?</p>
        <div className="flex flex-wrap justify-center gap-2">
          <BookDemoButton label="Book a call" variant="outline" />
          <Button
            variant="ghost"
            onClick={() => {
              track("select_plan", { plan: "enterprise" });
              openChat();
            }}
          >
            Chat to us
          </Button>
        </div>
      </div>
    </div>
  );
}
