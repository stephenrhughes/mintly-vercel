import { Button, Text } from "@react-email/components";

import type { ChangeKind } from "@/lib/billing/change-plan";
import { longDate, money } from "@/lib/billing/format";

import { EmailLayout, text } from "./layout";

// Plan changes and trial reminders (plan §6.12, PLAN-08, PLAN-10).

const button = {
  backgroundColor: "#0f766e",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "15px",
  padding: "12px 20px",
} as const;

export function planChangedSubject(kind: ChangeKind, planName: string) {
  return kind === "downgrade_scheduled"
    ? `Your Mintly plan will change to the ${planName}`
    : `Your Mintly plan is now the ${planName}`;
}

/** PLAN-10: every change is confirmed to the owner. */
export function PlanChangedEmail({
  planName,
  kind,
  effectiveAt,
  amountDueNow,
  currency,
  subscriptionUrl,
}: {
  planName: string;
  kind: ChangeKind;
  effectiveAt: Date;
  amountDueNow: number | null;
  currency: string | null;
  subscriptionUrl: string;
}) {
  const lines: Record<ChangeKind, string> = {
    trial_switch: `Your free trial is now on the ${planName}. Your trial end date hasn't changed, and nothing has been charged.`,
    start_paid: `Your ${planName} has started and your free trial has ended.`,
    upgrade: `You're now on the ${planName}. The change took effect straight away.`,
    downgrade_scheduled: `Your plan will change to the ${planName} on ${longDate(effectiveAt)}. Until then nothing changes. You can cancel this change from the subscription page.`,
  };
  return (
    <EmailLayout preview={planChangedSubject(kind, planName)}>
      <Text style={text}>{lines[kind]}</Text>
      {amountDueNow !== null && amountDueNow > 0 ? (
        <Text style={text}>
          We&apos;ve charged {money(amountDueNow, currency ?? "gbp")} today, including VAT. Your
          invoice is in billing.
        </Text>
      ) : null}
      <Text style={text}>Your API key hasn&apos;t changed, so your integrations keep working.</Text>
      <Button href={subscriptionUrl} style={button}>
        View your subscription
      </Button>
    </EmailLayout>
  );
}

/** PLAN-08: 7, 3 and 1 days before a trial ends. */
export function TrialEndingEmail({
  orgName,
  daysLeft,
  trialEnd,
  hasCard,
  changePlanUrl,
}: {
  orgName: string;
  daysLeft: number;
  trialEnd: Date;
  hasCard: boolean;
  changePlanUrl: string;
}) {
  return (
    <EmailLayout preview={trialEndingSubject(daysLeft)}>
      <Text style={text}>
        {orgName}&apos;s free Mintly trial ends on {longDate(trialEnd)}
        {daysLeft === 1 ? ", tomorrow" : ""}.
      </Text>
      <Text style={text}>
        {hasCard
          ? "Your plan will then start automatically. To change plan first, or start paying now, choose a plan below."
          : "To keep your API key working after that, choose a plan and add a card. If you don't, your subscription will end with the trial."}
      </Text>
      <Button href={changePlanUrl} style={button}>
        Choose a plan
      </Button>
    </EmailLayout>
  );
}

export const trialEndingSubject = (daysLeft: number) =>
  daysLeft === 1 ? "Your Mintly trial ends tomorrow" : `Your Mintly trial ends in ${daysLeft} days`;

/** KEY-01: the owner is always told when the key is rotated. */
export function KeyRotatedEmail({
  orgName,
  rotatedBy,
  oldKeyUntil,
  subscriptionUrl,
}: {
  orgName: string;
  rotatedBy: string;
  oldKeyUntil: Date | null;
  subscriptionUrl: string;
}) {
  return (
    <EmailLayout preview="Your Mintly API key was replaced">
      <Text style={text}>
        {rotatedBy} replaced {orgName}&apos;s Mintly API key.{" "}
        {oldKeyUntil
          ? `The previous key keeps working until ${oldKeyUntil.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" })}, then stops.`
          : "The previous key has stopped working."}
      </Text>
      <Text style={text}>
        Update your integrations with the new key from the subscription page. If you didn&apos;t
        expect this, contact us straight away.
      </Text>
      <Button href={subscriptionUrl} style={button}>
        Get the new key
      </Button>
    </EmailLayout>
  );
}

export const keyRotatedSubject = "Your Mintly API key was replaced";
