import { Text } from "@react-email/components";

import { EmailLayout, text } from "./layout";

// AUTH-07: tells Mintly about each new user, once they have confirmed their email.
export function NewUserAdminEmail({
  email,
  name,
  companyName,
}: {
  email: string;
  name: string | null;
  companyName: string | null;
}) {
  return (
    <EmailLayout preview={`New user: ${email}`}>
      <Text style={text}>A new user has confirmed their account.</Text>
      <Text style={text}>
        Email: {email}
        <br />
        Name: {name ?? "Not given"}
        <br />
        Company: {companyName ?? "Not given"}
      </Text>
    </EmailLayout>
  );
}

export const newUserAdminSubject = (email: string) => `New user: ${email}`;
