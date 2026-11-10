import { Button, Text } from "@react-email/components";

import { EmailLayout, text } from "./layout";

// TEAM-07: an invite to join an organisation's Mintly team. The link opens
// /join/<token>, which asks before moving anyone (plan §6.6).
export function TeamInviteEmail({
  orgName,
  inviterName,
  rolePhrase,
  joinUrl,
  expiresOn,
}: {
  orgName: string;
  inviterName: string;
  /** "as a Developer", or "as its owner" (ADM-12). */
  rolePhrase: string;
  joinUrl: string;
  expiresOn: string;
}) {
  return (
    <EmailLayout preview={`${inviterName} has invited you to join ${orgName} on Mintly`}>
      <Text style={text}>
        {inviterName} has invited you to join {orgName}&apos;s Mintly team {rolePhrase}.
      </Text>
      <Text style={text}>
        Mintly checks UK bank account details and sort codes. Accept the invite to use your
        team&apos;s web tools and see its usage. Create an account or sign in with this email
        address.
      </Text>
      <Button
        href={joinUrl}
        style={{
          backgroundColor: "#0f766e",
          borderRadius: "6px",
          color: "#ffffff",
          fontSize: "15px",
          padding: "12px 20px",
        }}
      >
        Accept the invite
      </Button>
      <Text style={text}>
        The invite expires on {expiresOn}. If you weren&apos;t expecting it, you can ignore this
        email.
      </Text>
    </EmailLayout>
  );
}

export const teamInviteSubject = (orgName: string) => `You're invited to join ${orgName} on Mintly`;
