"use server";

import { NotifyOwnerEmail, notifyOwnerSubject } from "@/emails/notify-owner";
import { requireUser } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/hosts";
import { createSupabaseBillingStore } from "@/lib/billing/store-supabase";

export type NotifyState = { sent?: boolean; error?: string };

// One email per person an hour, on this server instance: enough to stop a
// double click or an impatient retry from flooding the owner's inbox.
const lastSent = new Map<string, number>();
const NOTIFY_INTERVAL_MS = 60 * 60 * 1000;

// PLAN-07: a developer or member who hits the limit asks the owner to upgrade.
export async function notifyOwner(): Promise<NotifyState> {
  const user = await requireUser("/tools");
  const membership = user.membership;
  if (!membership || membership.role === "owner") return { error: "There's no one to notify." };

  const last = lastSent.get(user.id);
  if (last && Date.now() - last < NOTIFY_INTERVAL_MS) return { sent: true };

  // Only the server sends email, so it reads the owner's address with the
  // service role, for the organisation the membership above names.
  let ownerEmail: string | undefined;
  try {
    ownerEmail = (await createSupabaseBillingStore().getOwner(membership.orgId))?.email;
  } catch (error) {
    console.error("finding the owner failed", error);
  }
  if (!ownerEmail) {
    return { error: "We couldn't reach your account owner. Please ask them directly." };
  }

  const requesterName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
  try {
    await sendEmail({
      to: ownerEmail,
      subject: notifyOwnerSubject(requesterName),
      replyTo: user.email,
      react: NotifyOwnerEmail({
        orgName: membership.orgName,
        requesterName,
        changePlanUrl: appUrl("/subscription/change"),
      }),
    });
  } catch (sendError) {
    console.error("notifying the owner failed", sendError);
    return { error: "We couldn't send the email. Please try again." };
  }
  lastSent.set(user.id, Date.now());
  return { sent: true };
}
