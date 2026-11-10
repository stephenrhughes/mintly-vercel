import "server-only";

import { addContact } from "@/lib/brevo";
import { provisionDeps } from "@/lib/billing/server";
import { syncSubscription } from "@/lib/billing/provision";
import { sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/hosts";
import { siteConfig } from "@/lib/site";
import { requireStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/admin";
import { sendHeldInvites } from "@/lib/team/operations";
import { teamDeps } from "@/lib/team/server";
import {
  ReviewApprovedEmail,
  reviewApprovedSubject,
  ReviewDeclinedEmail,
  reviewDeclinedSubject,
  ReviewExpiredEmail,
  reviewExpiredSubject,
  ReviewInfoRequestEmail,
  reviewInfoRequestSubject,
} from "@/emails/review";

import type { ReviewDeps } from "./operations";

// Wires review decisions to Stripe, provisioning, Resend and Brevo.

const longDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });

export function reviewDeps(): ReviewDeps {
  // Read when needed, so decisions that don't touch Stripe work without it.
  const stripe = () => requireStripe();
  return {
    db: createServiceClient(),
    stripe: {
      async setTrialEnd(subscriptionId, trialEnd) {
        await stripe().subscriptions.update(subscriptionId, {
          trial_end: Math.floor(trialEnd.getTime() / 1000),
          proration_behavior: "none",
        });
      },
      async cancel(subscriptionId, comment) {
        await stripe().subscriptions.cancel(
          subscriptionId,
          { cancellation_details: { comment } },
          { idempotencyKey: `review-cancel-${subscriptionId}` },
        );
      },
    },
    async syncSubscription(subscriptionId) {
      await syncSubscription(provisionDeps(), subscriptionId, null);
    },
    notify: {
      async approved(to, { orgName, trialEnd }) {
        await sendEmail({
          to,
          subject: reviewApprovedSubject,
          react: ReviewApprovedEmail({
            orgName,
            trialEnd: trialEnd ? longDate(trialEnd) : null,
            subscriptionUrl: appUrl("/subscription"),
          }),
        });
      },
      async infoRequest(to, { orgName, message }) {
        await sendEmail({
          to,
          subject: reviewInfoRequestSubject,
          react: ReviewInfoRequestEmail({ orgName, message }),
          replyTo: siteConfig.supportEmail,
        });
      },
      async declined(to, { orgName }) {
        await sendEmail({
          to,
          subject: reviewDeclinedSubject,
          react: ReviewDeclinedEmail({ orgName }),
        });
      },
      async expired(to, { orgName }) {
        await sendEmail({
          to,
          subject: reviewExpiredSubject,
          react: ReviewExpiredEmail({ orgName }),
        });
      },
      addToMarketingList: addContact,
    },
    sendHeldInvites: (orgId, orgName) => sendHeldInvites(teamDeps(), { orgId, orgName }),
  };
}
