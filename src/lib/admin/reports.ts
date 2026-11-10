// The business dashboard (ADM-14) as pure functions: sign-ups, trial
// reviews and time to approve, trial-to-paid conversion, cancellations with
// their reasons, and recurring revenue by plan.

export type MonthKey = string; // "2026-11"

export const monthKey = (date: Date): MonthKey => date.toISOString().slice(0, 7);

/** The last n months, oldest first, ending with the month of `now`. */
export function lastMonths(now: Date, n: number): MonthKey[] {
  const months: MonthKey[] = [];
  for (let i = n - 1; i >= 0; i--) {
    months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return months;
}

export const monthLabel = (key: MonthKey) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export type ReportOrg = {
  createdAt: Date;
  reviewStatus: "pending_review" | "approved" | "rejected" | "suspended";
  reviewedAt: Date | null;
  /** Approved by a rule or an admin set-up, not by a person reviewing it. */
  autoApproved: boolean;
  endedAt: Date | null;
  cancellationReason: string | null;
};

export type ReviewDecision = { at: Date; action: "approve" | "decline" | "expire" };

export type ReportSubscription = {
  product: "bank_checker" | "eiscd";
  status: string;
  trialing: boolean;
  expired: boolean;
  /** Set when the subscription had a trial at some point. */
  trialEnd: Date | null;
};

export type MonthRow = {
  month: MonthKey;
  signUps: number;
  newOrganisations: number;
  approved: number;
  declined: number;
  /** Median hours from sign-up to an admin's approval, for those reviewed by hand. */
  medianHoursToApprove: number | null;
  cancellations: number;
};

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const HOUR = 60 * 60 * 1000;

export function monthlyRows(input: {
  months: MonthKey[];
  signUps: Date[];
  orgs: ReportOrg[];
  decisions: ReviewDecision[];
}): MonthRow[] {
  return input.months.map((month) => {
    const inMonth = (d: Date | null) => Boolean(d) && monthKey(d!) === month;
    const approvedByHand = input.orgs.filter(
      (o) =>
        !o.autoApproved && o.reviewedAt && inMonth(o.reviewedAt) && o.reviewStatus !== "rejected",
    );
    return {
      month,
      signUps: input.signUps.filter(inMonth).length,
      newOrganisations: input.orgs.filter((o) => inMonth(o.createdAt)).length,
      approved: input.decisions.filter((d) => d.action === "approve" && inMonth(d.at)).length,
      declined: input.decisions.filter((d) => d.action !== "approve" && inMonth(d.at)).length,
      medianHoursToApprove: median(
        approvedByHand.map((o) => (o.reviewedAt!.getTime() - o.createdAt.getTime()) / HOUR),
      ),
      cancellations: input.orgs.filter((o) => inMonth(o.endedAt)).length,
    };
  });
}

/**
 * Trial-to-paid conversion: of Bank Account Checker subscriptions that had
 * a trial and have since finished it, how many are now paying. Those still
 * trialing don't count either way.
 */
export function trialConversion(subs: ReportSubscription[]): {
  converted: number;
  lost: number;
  rate: number | null;
} {
  const trials = subs.filter((s) => s.product === "bank_checker" && s.trialEnd && !s.trialing);
  const converted = trials.filter(
    (s) => !s.expired && (s.status === "active" || s.status === "past_due"),
  ).length;
  const lost = trials.filter((s) => s.expired).length;
  return { converted, lost, rate: converted + lost ? converted / (converted + lost) : null };
}

/** Cancellation reasons, most common first (CANC-01). */
export function cancellationReasons(
  orgs: ReportOrg[],
  since: Date,
): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();
  for (const o of orgs) {
    if (!o.endedAt || o.endedAt < since) continue;
    const reason = o.cancellationReason?.trim() || "No reason given";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

export type RevenueLine = {
  planName: string;
  unitAmount: number | null;
  quantity: number;
  interval: string | null;
  intervalCount: number;
  currency: string;
};

const MONTHS_PER: Record<string, number> = { day: 12 / 365, week: 12 / 52, month: 1, year: 12 };

/** A price's charge as a monthly amount, in pence. */
export function monthlyAmount(line: RevenueLine): number {
  if (line.unitAmount === null || !line.interval) return 0;
  const months = (MONTHS_PER[line.interval] ?? 1) * Math.max(1, line.intervalCount);
  return (line.unitAmount * line.quantity) / months;
}

/** Monthly recurring revenue by plan, from live paid subscriptions, largest first. */
export function revenueByPlan(lines: RevenueLine[]): Array<{
  planName: string;
  currency: string;
  subscriptions: number;
  monthly: number;
}> {
  const byPlan = new Map<
    string,
    { planName: string; currency: string; subscriptions: number; monthly: number }
  >();
  for (const line of lines) {
    const key = `${line.planName}|${line.currency}`;
    const entry = byPlan.get(key) ?? {
      planName: line.planName,
      currency: line.currency,
      subscriptions: 0,
      monthly: 0,
    };
    entry.subscriptions += 1;
    entry.monthly += monthlyAmount(line);
    byPlan.set(key, entry);
  }
  return [...byPlan.values()]
    .map((e) => ({ ...e, monthly: Math.round(e.monthly) }))
    .sort((a, b) => b.monthly - a.monthly);
}
