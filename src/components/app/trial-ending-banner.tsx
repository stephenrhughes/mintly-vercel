import { Clock } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { longDate } from "@/lib/billing/format";

/** Whether to show the trial-ending banner: an approved trial ending within 7 days (PLAN-08). */
export function trialEndsSoon(trialEnd: Date | null, now = new Date()): boolean {
  if (!trialEnd) return false;
  const left = trialEnd.getTime() - now.getTime();
  return left > 0 && left <= 7 * 24 * 60 * 60 * 1000;
}

// PLAN-08: a banner before the trial ends, linking to Change plan.
export function TrialEndingBanner({
  trialEnd,
  isOwner,
  changePlanHref,
}: {
  trialEnd: Date;
  isOwner: boolean;
  changePlanHref: string;
}) {
  return (
    <Alert>
      <Clock aria-hidden />
      <AlertTitle>Your free trial ends on {longDate(trialEnd)}</AlertTitle>
      <AlertDescription>
        {isOwner ? (
          <>
            <p>Choose a plan and add a card to keep your API key working after the trial.</p>
            <Button asChild size="sm" className="mt-2">
              <a href={changePlanHref}>Choose a plan</a>
            </Button>
          </>
        ) : (
          <p>
            Ask your account owner to choose a plan, so your API key keeps working after the trial.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
