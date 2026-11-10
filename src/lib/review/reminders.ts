// What the hourly reminders job does about pending reviews (plan §6.11
// safety nets, APPR-07): remind admins once a review has waited 4 working
// hours, and decline it after 7 days.

import { reviewHasExpired, reviewIsOverdue } from "./rules";

export type PendingReview = { id: string; createdAt: Date; reminderSentAt: Date | null };

export function planReminders(
  pending: readonly PendingReview[],
  now: Date,
): { expire: string[]; remind: string[] } {
  const expire: string[] = [];
  const remind: string[] = [];
  for (const review of pending) {
    if (reviewHasExpired(review.createdAt, now)) expire.push(review.id);
    else if (!review.reminderSentAt && reviewIsOverdue(review.createdAt, now))
      remind.push(review.id);
  }
  return { expire, remind };
}
