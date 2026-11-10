// Changing plan (plan §6.12, PLAN-01 to PLAN-07) as pure rules: which
// change a request is, whether it's allowed, and what to recommend.

import type { ReviewStatus } from "@/lib/nav";

import {
  type BillingInterval,
  PLAN_TIERS,
  PLANS,
  type PlanTier,
  SELF_SERVE_CEILING,
} from "./plans";
import { isLiveStatus } from "./subscription-record";

export type CurrentPlan = {
  status: string;
  trialing: boolean;
  /** Set when the subscription is due to end. */
  cancelAt: Date | null;
  priceId: string;
  /** Null for a legacy or custom price. */
  tier: PlanTier | null;
  interval: BillingInterval | null;
  custom: boolean;
  reviewStatus: ReviewStatus;
};

export type ChangeRequest = {
  tier: PlanTier;
  interval: BillingInterval;
  /** During a trial: keep trialing on the new plan, or start paying now (PLAN-02, PLAN-03). */
  mode: "switch" | "start_paid";
};

export type ChangeKind = "trial_switch" | "start_paid" | "upgrade" | "downgrade_scheduled";

export type BlockReason =
  | "not_live"
  | "custom_price"
  | "past_due"
  | "cancelling"
  | "same_plan"
  | "seats"
  | "pending_review";

export type Classification =
  | { allowed: true; kind: ChangeKind; warnings: string[] }
  | { allowed: false; reason: BlockReason; message: string };

const rank = (tier: PlanTier) => PLAN_TIERS.indexOf(tier);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What a change request is, and whether it's allowed (PLAN-02 to PLAN-06, PLAN-10). */
export function classifyChange(
  current: CurrentPlan,
  request: ChangeRequest,
  team: { seatsUsed: number; extraUsers: number },
  usage: { monthlyChecks: number | null } = { monthlyChecks: null },
): Classification {
  if (!isLiveStatus(current.status)) {
    return {
      allowed: false,
      reason: "not_live",
      message: "You don't have a live subscription to change.",
    };
  }
  if (current.custom) {
    return {
      allowed: false,
      reason: "custom_price",
      message: "Your plan was set up for you, so contact us to change it.",
    };
  }
  if (current.status === "past_due") {
    return {
      allowed: false,
      reason: "past_due",
      message: "Your last payment didn't go through. Update your payment details in billing first.",
    };
  }
  if (current.cancelAt) {
    return {
      allowed: false,
      reason: "cancelling",
      message: "Your subscription is set to end. Resume it in billing before changing plan.",
    };
  }

  // PLAN-06: never leave more people than seats.
  const plan = PLANS[request.tier];
  const seats = plan.maxUsers + team.extraUsers;
  if (team.seatsUsed > seats) {
    const over = team.seatsUsed - seats;
    return {
      allowed: false,
      reason: "seats",
      message: `${plan.name} includes ${plural(seats, "seat", "seats")} and your team has ${team.seatsUsed}. Remove ${plural(over, "person", "people")} first.`,
    };
  }

  const samePlan = current.tier === request.tier && current.interval === request.interval;
  const warnings: string[] = [];
  if (usage.monthlyChecks !== null && usage.monthlyChecks > plan.includedRequestsCount) {
    warnings.push(
      `Your recent usage, about ${usage.monthlyChecks.toLocaleString("en-GB")} checks a month, is more than the ${plan.includedRequests} ${plan.name} includes, so you'd pay ${plan.pricePerRequest} for each check over.`,
    );
  }

  if (current.trialing) {
    if (request.mode === "start_paid") {
      // Nobody pays for access they can't use yet (plan §6.12 rules).
      if (current.reviewStatus !== "approved") {
        return {
          allowed: false,
          reason: "pending_review",
          message: "You can start paying once we've approved your account.",
        };
      }
      return { allowed: true, kind: "start_paid", warnings };
    }
    if (samePlan)
      return { allowed: false, reason: "same_plan", message: "That's your current plan." };
    return { allowed: true, kind: "trial_switch", warnings };
  }

  if (samePlan)
    return { allowed: false, reason: "same_plan", message: "That's your current plan." };

  // PLAN-04: a higher tier, or monthly to annual, takes effect now with a
  // prorated charge. Anything lower, or annual to monthly, waits for the
  // end of the period. A legacy price moves now.
  if (current.tier === null || current.interval === null) {
    return { allowed: true, kind: "upgrade", warnings };
  }
  const shorterPeriod = current.interval === "annual" && request.interval === "monthly";
  const higherTier = rank(request.tier) > rank(current.tier);
  const sameTierLonger =
    rank(request.tier) === rank(current.tier) &&
    current.interval === "monthly" &&
    request.interval === "annual";
  if ((higherTier || sameTierLonger) && !shorterPeriod) {
    return { allowed: true, kind: "upgrade", warnings };
  }
  return { allowed: true, kind: "downgrade_scheduled", warnings };
}

export type Recommendation = { tier: PlanTier; reason: string } | { tier: null; reason: string };

/**
 * The smallest plan that fits the team and, once usage is synced (phase 3),
 * recent usage (PLAN-07). Above the self-serve ceiling, talk to Mintly.
 */
export function recommendPlan(input: {
  seatsUsed: number;
  monthlyChecks: number | null;
}): Recommendation {
  if (input.monthlyChecks !== null && input.monthlyChecks > SELF_SERVE_CEILING) {
    return { tier: null, reason: "Above 50,000 checks a month, talk to us about volume pricing." };
  }
  for (const tier of PLAN_TIERS) {
    const plan = PLANS[tier];
    const fitsTeam = plan.maxUsers >= input.seatsUsed;
    const fitsUsage =
      input.monthlyChecks === null || plan.includedRequestsCount >= input.monthlyChecks;
    if (fitsTeam && fitsUsage) {
      const reasons = [
        `fits your team of ${input.seatsUsed}`,
        ...(input.monthlyChecks !== null
          ? [`covers about ${input.monthlyChecks.toLocaleString("en-GB")} checks a month`]
          : []),
      ];
      return { tier, reason: `${plan.name} ${reasons.join(" and ")}.` };
    }
  }
  // More people than the largest plan includes: Professional, plus seats from Mintly.
  return {
    tier: "professional",
    reason: "Professional has the most seats; contact us if you need more.",
  };
}

/** Whether a trial-ending reminder is due (PLAN-08): 7, 3 and 1 days before the end. */
export const TRIAL_REMINDER_DAYS = [7, 3, 1] as const;

export function dueTrialReminder(
  trialEnd: Date,
  now: Date,
  sent: readonly number[],
): { send: number; markSent: number[] } | null {
  const msLeft = trialEnd.getTime() - now.getTime();
  if (msLeft <= 0) return null;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  const due = TRIAL_REMINDER_DAYS.filter((d) => daysLeft <= d && !sent.includes(d));
  if (due.length === 0) return null;
  // If the job missed one (say 7 and 3 are both due), send only the nearest.
  return { send: Math.min(...due), markSent: due };
}
