import { CheckList } from "@/components/site/check-list";
import { PLAN_TIERS, PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/** The three self-serve plans in brief, from plans.ts. */
export function PlanSummaryCards() {
  return (
    <div className="mt-10 grid gap-6 md:grid-cols-3">
      {PLAN_TIERS.map((tier) => {
        const plan = PLANS[tier];
        const popular = tier === "standardPlus";
        return (
          <div
            key={tier}
            className={cn(
              "rounded-xl border bg-card p-6 shadow-xs",
              popular && "border-primary ring-2 ring-primary/20",
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{plan.name.replace(/ Plan$/, "")}</h3>
              {popular && (
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                  Most popular
                </span>
              )}
            </div>
            <p className="mt-4 text-3xl font-semibold">
              {plan.monthlyPrice}
              <span className="ml-1 text-sm font-normal text-muted-foreground">per month</span>
            </p>
            <CheckList
              className="mt-4 text-sm"
              items={[
                `${plan.includedRequests} requests/month`,
                `Up to ${Number(plan.throttle).toLocaleString("en-GB")} req/sec`,
                "Full API access",
                "Sandbox included",
              ]}
            />
          </div>
        );
      })}
    </div>
  );
}
