import { connection } from "next/server";

import { isCronRequest } from "@/lib/cron";
import { runReviewReminders } from "@/lib/review/run-reminders";
import { reviewDeps } from "@/lib/review/server";
import { getStripe } from "@/lib/stripe/client";

// The hourly reminders job (plan §8, vercel.json). For now it handles trial
// reviews: a reminder after 4 working hours and expiry after 7 days
// (APPR-07). Trial-ending reminders join it in phase 2c (PLAN-08).

export const maxDuration = 300;

export async function GET(request: Request) {
  await connection();
  if (!isCronRequest(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  if (!getStripe()) return Response.json({ error: "Stripe is not configured" }, { status: 503 });

  try {
    const run = await runReviewReminders(reviewDeps());
    console.info(JSON.stringify({ msg: "cron reminders", ...run }));
    return Response.json(run, { status: run.errors.length > 0 ? 500 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ msg: "cron reminders failed", error: message }));
    return Response.json({ error: "Reminders failed" }, { status: 500 });
  }
}
