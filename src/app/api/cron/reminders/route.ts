import { connection } from "next/server";

import { TrialEndingEmail, trialEndingSubject } from "@/emails/plan-change";
import { stripePlanChanges } from "@/lib/billing/plan-change-server";
import { retireDueKeys } from "@/lib/billing/rotate-key";
import { rotateKeyDeps } from "@/lib/billing/rotate-key-server";
import { runTrialReminders } from "@/lib/billing/trial-reminders";
import { isCronRequest } from "@/lib/cron";
import { sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/hosts";
import { runReviewReminders } from "@/lib/review/run-reminders";
import { reviewDeps } from "@/lib/review/server";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/admin";

// The hourly reminders job (plan §8, vercel.json):
// - trial reviews: a reminder after 4 working hours, expiry after 7 days (APPR-07)
// - trial-ending reminders 7, 3 and 1 days before the end (PLAN-08)
// - turning off keys whose rotation overlap has ended (KEY-01)
// Each part runs even if another fails, and failures make the response 500.

export const maxDuration = 300;

async function step<T>(
  name: string,
  task: () => Promise<T>,
): Promise<{ name: string; result?: T; error?: string }> {
  try {
    return { name, result: await task() };
  } catch (error) {
    return { name, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(request: Request) {
  await connection();
  if (!isCronRequest(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const stripe = getStripe();
  const steps = [
    await step("keys", () => retireDueKeys(rotateKeyDeps(), new Date())),
    stripe
      ? await step("reviews", () => runReviewReminders(reviewDeps()))
      : { name: "reviews", error: "Stripe is not configured" },
    await step("trials", () =>
      runTrialReminders({
        db: createServiceClient(),
        async hasCard(subscriptionId) {
          if (!stripe) return false;
          return (await stripePlanChanges(stripe).getSubscription(subscriptionId)).hasPaymentMethod;
        },
        async send({ to, orgName, daysLeft, trialEnd, hasCard }) {
          await sendEmail({
            to,
            subject: trialEndingSubject(daysLeft),
            react: TrialEndingEmail({
              orgName,
              daysLeft,
              trialEnd,
              hasCard,
              changePlanUrl: appUrl("/subscription/change"),
            }),
          });
        },
      }),
    ),
  ];

  const failed = steps.some(
    (s) =>
      s.error ||
      (s.result &&
        typeof s.result === "object" &&
        "errors" in s.result &&
        (s.result.errors as string[]).length > 0),
  );
  console.info(JSON.stringify({ msg: "cron reminders", steps }));
  return Response.json({ steps }, { status: failed ? 500 : 200 });
}
