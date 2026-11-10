import "server-only";

import { sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/hosts";
import { inviteRolePhrase } from "./rules";
import { createServiceClient } from "@/lib/supabase/admin";
import { TeamInviteEmail, teamInviteSubject } from "@/emails/team-invite";

import type { TeamDeps } from "./operations";

// Wires team changes to the service-role database and Resend.

const longDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });

export function joinUrl(token: string): string {
  return appUrl(`/join/${encodeURIComponent(token)}`);
}

export function teamDeps(): TeamDeps {
  return {
    db: createServiceClient(),
    async sendInvite(to, invite) {
      await sendEmail({
        to,
        subject: teamInviteSubject(invite.orgName),
        react: TeamInviteEmail({
          orgName: invite.orgName,
          inviterName: invite.inviterName,
          rolePhrase: inviteRolePhrase(invite.role),
          joinUrl: joinUrl(invite.token),
          expiresOn: longDate(invite.expiresAt),
        }),
      });
    },
  };
}
