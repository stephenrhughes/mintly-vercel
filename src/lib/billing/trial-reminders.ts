import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { dueTrialReminder } from "./change-plan";

// PLAN-08: trial customers are reminded 7, 3 and 1 days before the trial
// ends, with a link to choose a plan. Only approved organisations: a
// pending trial hasn't really started (APPR-06).

export type TrialReminderDeps = {
  db: SupabaseClient;
  /** Whether the subscription has a card, so the email says what happens next. */
  hasCard(stripeSubscriptionId: string): Promise<boolean>;
  send(input: {
    to: string;
    orgName: string;
    daysLeft: number;
    trialEnd: Date;
    hasCard: boolean;
  }): Promise<void>;
  now?: () => Date;
};

type Row = {
  id: string;
  org_id: string;
  stripe_subscription_id: string;
  trial_end: string | null;
  trial_reminders_sent: number[];
  trial_reminders_for: string | null;
  organisations: { name: string; review_status: string } | null;
};

export async function runTrialReminders(
  deps: TrialReminderDeps,
): Promise<{ sent: string[]; errors: string[] }> {
  const now = deps.now?.() ?? new Date();
  const { data, error } = await deps.db
    .from("subscriptions")
    .select(
      "id, org_id, stripe_subscription_id, trial_end, trial_reminders_sent, trial_reminders_for, organisations (name, review_status)",
    )
    .eq("trialing", true)
    .eq("expired", false)
    .eq("product", "bank_checker")
    .not("trial_end", "is", null)
    .returns<Row[]>();
  if (error) throw new Error(`reading trials failed: ${error.message}`);

  const result = { sent: [] as string[], errors: [] as string[] };
  for (const row of data) {
    if (row.organisations?.review_status !== "approved" || !row.trial_end) continue;
    const trialEnd = new Date(row.trial_end);
    // A trial whose end moved (approval or an extension) starts its reminders again.
    const sameTrial =
      row.trial_reminders_for && new Date(row.trial_reminders_for).getTime() === trialEnd.getTime();
    const sent = sameTrial ? row.trial_reminders_sent : [];
    const due = dueTrialReminder(trialEnd, now, sent);
    if (!due) continue;

    try {
      const { data: owner } = await deps.db
        .from("memberships")
        .select("user_id")
        .eq("org_id", row.org_id)
        .eq("role", "owner")
        .maybeSingle<{ user_id: string }>();
      const { data: profile } = owner
        ? await deps.db
            .from("profiles")
            .select("email")
            .eq("id", owner.user_id)
            .maybeSingle<{ email: string }>()
        : { data: null };

      // Record first, so a failure after this never sends twice.
      const { error: markError } = await deps.db
        .from("subscriptions")
        .update({
          trial_reminders_sent: [...new Set([...sent, ...due.markSent])],
          trial_reminders_for: trialEnd.toISOString(),
        })
        .eq("id", row.id);
      if (markError) throw new Error(markError.message);

      if (profile?.email) {
        await deps.send({
          to: profile.email,
          orgName: row.organisations.name,
          daysLeft: due.send,
          trialEnd,
          hasCard: await deps.hasCard(row.stripe_subscription_id).catch(() => false),
        });
        result.sent.push(row.org_id);
      }
    } catch (e) {
      result.errors.push(`${row.org_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}
