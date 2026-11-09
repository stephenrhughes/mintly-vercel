import "server-only";

import { ReviewReminderAdminEmail, reviewReminderAdminSubject } from "@/emails/review";
import { adminNotifyEmail, sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/hosts";

import { expire, type ReviewDeps } from "./operations";
import { planReminders } from "./reminders";
import { waitingFor } from "./rules";

export type ReminderRun = { expired: string[]; reminded: string[]; errors: string[] };

/** The review part of the hourly reminders job (plan §6.11, APPR-07). */
export async function runReviewReminders(deps: ReviewDeps): Promise<ReminderRun> {
  const now = deps.now?.() ?? new Date();
  const { data, error } = await deps.db
    .from("organisations")
    .select("id, name, created_at, review_reminder_sent_at, signup_signals")
    .eq("review_status", "pending_review")
    .order("created_at", { ascending: true })
    .returns<
      Array<{
        id: string;
        name: string;
        created_at: string;
        review_reminder_sent_at: string | null;
        signup_signals: { email?: string } | null;
      }>
    >();
  if (error) throw new Error(`reading pending reviews failed: ${error.message}`);

  const plan = planReminders(
    data.map((org) => ({
      id: org.id,
      createdAt: new Date(org.created_at),
      reminderSentAt: org.review_reminder_sent_at ? new Date(org.review_reminder_sent_at) : null,
    })),
    now,
  );

  const run: ReminderRun = { expired: [], reminded: [], errors: [] };

  for (const orgId of plan.expire) {
    try {
      const result = await expire(deps, { orgId });
      if (result.ok) run.expired.push(orgId);
      else run.errors.push(`${orgId}: ${result.error}`);
    } catch (error) {
      run.errors.push(`${orgId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const due = data.filter((org) => plan.remind.includes(org.id));
  if (due.length > 0) {
    await sendEmail({
      to: adminNotifyEmail(),
      subject: reviewReminderAdminSubject(due.length),
      react: ReviewReminderAdminEmail({
        reviews: due.map((org) => ({
          orgName: org.name,
          email: org.signup_signals?.email ?? "unknown",
          waiting: waitingFor(new Date(org.created_at), now),
        })),
        queueUrl: appUrl("/admin/reviews"),
      }),
    });
    const { error: markError } = await deps.db
      .from("organisations")
      .update({ review_reminder_sent_at: now.toISOString() })
      .in(
        "id",
        due.map((org) => org.id),
      );
    if (markError) run.errors.push(`marking reminders failed: ${markError.message}`);
    run.reminded.push(...due.map((org) => org.id));
  }
  return run;
}
