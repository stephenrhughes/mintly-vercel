import { Text } from "@react-email/components";

import { EmailLayout, text } from "./layout";

// LEAD-01: a new enquiry for the sales inbox. Plain text from the
// questionnaire, so nothing from the public form is rendered as markup.
export function EnquiryNoticeEmail({
  transcript,
  sourcePage,
}: {
  transcript: string;
  sourcePage: string | null;
}) {
  return (
    <EmailLayout preview="New enquiry from the website">
      <Text style={{ ...text, whiteSpace: "pre-wrap" }}>{transcript}</Text>
      {sourcePage && <Text style={{ ...text, color: "#6b7280" }}>Sent from {sourcePage}</Text>}
      <Text style={{ ...text, color: "#6b7280" }}>
        Reply to this email to answer them directly.
      </Text>
    </EmailLayout>
  );
}

export const enquiryNoticeSubject = (summary: string, name: string) =>
  `New enquiry - ${summary} - ${name}`;
