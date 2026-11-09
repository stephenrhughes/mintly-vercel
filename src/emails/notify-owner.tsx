import { Button, Text } from "@react-email/components";

import { EmailLayout, text } from "./layout";

// PLAN-07: someone who isn't the owner hit the plan's limit on the Tools
// page and asked the owner to upgrade.
export function NotifyOwnerEmail({
  orgName,
  requesterName,
  changePlanUrl,
}: {
  orgName: string;
  requesterName: string;
  changePlanUrl: string;
}) {
  return (
    <EmailLayout preview={`${requesterName} has reached ${orgName}'s check limit`}>
      <Text style={text}>
        {requesterName} reached {orgName}&apos;s request limit while using the Mintly web tools, and
        asked us to let you know.
      </Text>
      <Text style={text}>
        If your team needs more checks, you can move to a bigger plan yourself. The API key stays
        the same, so nothing needs to change in your integrations.
      </Text>
      <Button
        href={changePlanUrl}
        style={{
          backgroundColor: "#0f766e",
          borderRadius: "6px",
          color: "#ffffff",
          fontSize: "15px",
          padding: "12px 20px",
        }}
      >
        Change plan
      </Button>
    </EmailLayout>
  );
}

export const notifyOwnerSubject = (requesterName: string) =>
  `${requesterName} has reached your Mintly check limit`;
