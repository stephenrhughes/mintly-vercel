// How a subscription is described in the app (SUB-01, SUB-02).

export type SubscriptionView = {
  id: string;
  product: "bank_checker" | "eiscd";
  stripePriceId: string;
  status: string;
  trialing: boolean;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  expired: boolean;
  maxTeamSize: number | null;
  extraUsers: number;
  apiKeyId: string | null;
  keyEnabled: boolean;
  keyNoticeAt: Date | null;
  keyNoticeDismissedAt: Date | null;
};

export type StatusTone = "good" | "warning" | "inactive";

export type SubscriptionStatus = {
  /** SUB-02: not expired, and the key is enabled. */
  active: boolean;
  label: string;
  tone: StatusTone;
  /** The date line under the plan name, if any. */
  dateLine: string | null;
};

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });

export function describeSubscription(sub: SubscriptionView): SubscriptionStatus {
  const active = !sub.expired && Boolean(sub.apiKeyId) && sub.keyEnabled;

  if (sub.expired) {
    return {
      active: false,
      label: "Ended",
      tone: "inactive",
      dateLine: sub.cancelAt ? `Ended on ${formatDate(sub.cancelAt)}` : null,
    };
  }
  if (sub.cancelAt) {
    return {
      active,
      label: "Cancelling",
      tone: "warning",
      dateLine: `Ends on ${formatDate(sub.cancelAt)}`,
    };
  }
  if (sub.status === "past_due") {
    return {
      active,
      label: "Payment overdue",
      tone: "warning",
      dateLine: "Update your payment details to keep your subscription.",
    };
  }
  if (sub.trialing) {
    return {
      active,
      label: "Free trial",
      tone: active ? "good" : "inactive",
      dateLine: sub.trialEnd ? `Trial ends on ${formatDate(sub.trialEnd)}` : null,
    };
  }
  return {
    active,
    label: active ? "Active" : "Inactive",
    tone: active ? "good" : "inactive",
    dateLine: sub.currentPeriodEnd ? `Renews on ${formatDate(sub.currentPeriodEnd)}` : null,
  };
}

/** Whether to show the "you have a new key" notice (BILL-08). */
export function showKeyNotice(sub: SubscriptionView): boolean {
  return Boolean(sub.keyNoticeAt) && !sub.keyNoticeDismissedAt && !sub.expired;
}
