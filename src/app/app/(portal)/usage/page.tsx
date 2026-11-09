import { TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth/session";
import { recommendPlan } from "@/lib/billing/change-plan";
import { isPlanTier, PLANS } from "@/lib/billing/plans";
import { getOrgSubscriptions } from "@/lib/billing/queries";
import type { SubscriptionView } from "@/lib/billing/status";
import { priceMeta } from "@/lib/billing/subscription-record";
import { appPath } from "@/lib/hosts";
import { getPrice } from "@/lib/stripe/catalogue";
import { getStripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { getOrgUsage, type OrgUsage } from "@/lib/usage/queries";
import { numberWithCommas, projectedMonthlyUsage } from "@/lib/usage/series";

import { UsageChart } from "./usage-chart";

export const metadata: Metadata = { title: "Usage" };

const title = "Usage";
const description = "Checks made with your organisation's API key, through the API and the tools.";

export default function UsagePage() {
  return (
    <Suspense fallback={<PageHeader title={title} description={description} />}>
      <Usage />
    </Suspense>
  );
}

const productNames = { bank_checker: "Bank Account Checker", eiscd: "EISCD" } as const;

const syncedText = (date: Date | null) =>
  date
    ? `Figures are updated daily. Last updated ${date.toLocaleString("en-GB", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
      })}.`
    : "Figures are updated daily.";

// Usage (plan §6.4, MON-*): read from usage_daily, which the nightly job
// fills from the API platform's statistics (Q3).
async function Usage() {
  const user = await requireUser("/usage");
  const membership = user.membership;

  if (!membership) {
    return (
      <div className="grid gap-8">
        <PageHeader title={title} description={description} />
        <Card>
          <CardHeader>
            <CardTitle>No plan yet</CardTitle>
            <CardDescription>
              Start a 14-day free trial to get an API key. Your usage will show here.
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
  const products = (["bank_checker", "eiscd"] as const).filter(
    (product) => product === "bank_checker" || current.some((s) => s.product === product),
  );
  const usage = await Promise.all(
    products.map(async (product) => {
      try {
        return await getOrgUsage(membership.orgId, product);
      } catch (error) {
        console.error("reading usage failed", product, error);
        return null;
      }
    }),
  );
  const now = new Date().toISOString();

  const panel = (product: (typeof products)[number], data: OrgUsage | null) => (
    <Card>
      <CardHeader>
        <CardTitle>{productNames[product]} API usage</CardTitle>
        <CardDescription>{syncedText(data?.lastSyncedAt ?? null)}</CardDescription>
      </CardHeader>
      <CardContent>
        {data ? (
          <UsageChart points={data.points} now={now} />
        ) : (
          <p className="text-sm text-destructive">
            We couldn&apos;t load your usage. Please try again shortly.
          </p>
        )}
      </CardContent>
    </Card>
  );

  const bankChecker = current.find((s) => s.product === "bank_checker");
  const bankUsage = usage[products.indexOf("bank_checker")];

  return (
    <div className="grid gap-8">
      <PageHeader title={title} description={description} />

      {bankChecker && bankUsage ? (
        <Suspense fallback={null}>
          <AllowanceBanner
            subscription={bankChecker}
            projected={projectedMonthlyUsage(bankUsage.points, now)}
            orgId={membership.orgId}
            isOwner={membership.role === "owner"}
          />
        </Suspense>
      ) : null}

      {products.length > 1 ? (
        <Tabs defaultValue="bank_checker">
          <TabsList aria-label="Product">
            {products.map((product) => (
              <TabsTrigger key={product} value={product}>
                {productNames[product]}
              </TabsTrigger>
            ))}
          </TabsList>
          {products.map((product, index) => (
            <TabsContent key={product} value={product}>
              {panel(product, usage[index])}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        panel("bank_checker", usage[0])
      )}
    </div>
  );
}

// Plan §6.12 prompts: when the projection is above the plan's allowance,
// say so and recommend a plan (PLAN-07). Owners get a link to change it.
async function AllowanceBanner({
  subscription,
  projected,
  orgId,
  isOwner,
}: {
  subscription: SubscriptionView;
  projected: number;
  orgId: string;
  isOwner: boolean;
}) {
  if (subscription.expired || !getStripe()) return null;
  let tier: string | null = null;
  try {
    const meta = priceMeta(await getPrice(subscription.stripePriceId));
    if (meta.custom || meta.product !== "bank_checker") return null;
    tier = meta.tier;
  } catch (error) {
    console.error("reading the price failed", error);
    return null;
  }
  if (!isPlanTier(tier)) return null;
  const plan = PLANS[tier];
  if (projected <= plan.includedRequestsCount) return null;

  const supabase = await createClient();
  const { count } = await supabase
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", orgId);
  const recommendation = recommendPlan({
    seatsUsed: Math.max(1, count ?? 1),
    monthlyChecks: projected,
  });

  return (
    <Alert>
      <TrendingUp aria-hidden />
      <AlertTitle>You&apos;re on course to go over your plan&apos;s allowance</AlertTitle>
      <AlertDescription>
        <p>
          At your recent rate you&apos;ll make about {numberWithCommas(projected)} checks this
          month. {plan.name} includes {plan.includedRequests}; checks above that are charged at{" "}
          {plan.pricePerRequest} each.
        </p>
        <p>
          {recommendation.tier && recommendation.tier !== tier
            ? `Recommended: ${recommendation.reason}`
            : recommendation.reason}
        </p>
        {isOwner ? (
          <Button asChild size="sm" className="mt-1">
            <a href={appPath("/subscription/change")}>Change plan</a>
          </Button>
        ) : (
          <p>Your account owner can change the plan.</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
