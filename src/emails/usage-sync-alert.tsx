import { Text } from "@react-email/components";

import { EmailLayout, text } from "./layout";

// Plan §9 observability: tells admins the nightly usage sync failed or found
// no data, so the usage charts and metering aren't quietly wrong.
export function UsageSyncAlertEmail({ reason, details }: { reason: string; details: string[] }) {
  return (
    <EmailLayout preview={reason}>
      <Text style={text}>{reason}.</Text>
      <Text style={text}>
        Customers&apos; usage charts may be out of date until the next run succeeds. The details are
        below and in the Vercel logs for /api/cron/usage-sync.
      </Text>
      {details.slice(0, 20).map((line) => (
        <Text key={line} style={{ ...text, fontFamily: "monospace", fontSize: "13px" }}>
          {line}
        </Text>
      ))}
    </EmailLayout>
  );
}

export const usageSyncAlertSubject = "Mintly usage sync needs attention";
