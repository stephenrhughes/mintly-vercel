import { Button, Text } from "@react-email/components";

import { EmailLayout, text } from "./layout";

// BILL-08: a returning customer has a new API key, and the old one has stopped working.
export function NewApiKeyEmail({
  orgName,
  subscriptionUrl,
}: {
  orgName: string;
  subscriptionUrl: string;
}) {
  return (
    <EmailLayout preview="You have a new API key">
      <Text style={text}>
        Welcome back. {orgName} has a new Mintly API key, because your previous subscription ended.
      </Text>
      <Text style={text}>
        <strong>Your previous key no longer works.</strong> Update any integrations that use it with
        the new key, which you can copy from the subscription page.
      </Text>
      <Button
        href={subscriptionUrl}
        style={{
          backgroundColor: "#0f766e",
          borderRadius: "6px",
          color: "#ffffff",
          fontSize: "15px",
          padding: "12px 20px",
        }}
      >
        View your new key
      </Button>
    </EmailLayout>
  );
}

export const newApiKeySubject = "You have a new Mintly API key";
