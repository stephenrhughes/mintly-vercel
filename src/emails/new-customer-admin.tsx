import { Text } from "@react-email/components";

import { EmailLayout, text } from "./layout";

// PROV-02: tells Mintly about each new customer.
export function NewCustomerAdminEmail({
  orgName,
  email,
  planName,
  trialing,
}: {
  orgName: string;
  email: string;
  planName: string;
  trialing: boolean;
}) {
  return (
    <EmailLayout preview={`New customer: ${orgName}`}>
      <Text style={text}>A new customer has subscribed.</Text>
      <Text style={text}>
        Organisation: {orgName}
        <br />
        Owner: {email}
        <br />
        Plan: {planName}
        {trialing ? " (free trial)" : ""}
      </Text>
    </EmailLayout>
  );
}

export const newCustomerAdminSubject = (orgName: string) => `New customer: ${orgName}`;
