import { Button, Text } from "@react-email/components";

import { siteConfig } from "@/lib/site";

import { EmailLayout, text } from "./layout";

// Trial review emails (plan §6.11, APPR-03 to APPR-07).

const button = {
  backgroundColor: "#0f766e",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "15px",
  padding: "12px 20px",
} as const;

/** To the owner when their trial is held for review. */
export function ReviewPendingEmail({ orgName, docsUrl }: { orgName: string; docsUrl: string }) {
  return (
    <EmailLayout preview="We're reviewing your account">
      <Text style={text}>Thanks for starting a Mintly trial for {orgName}.</Text>
      <Text style={text}>
        We review new trials to keep the service safe for everyone. This usually takes less than one
        working day, and your 14-day trial starts when we approve you, so you won&apos;t lose any of
        it.
      </Text>
      <Text style={text}>
        In the meantime you can read the documentation and try the API against the sandbox, which
        returns fixed test values.
      </Text>
      <Button href={docsUrl} style={button}>
        Read the documentation
      </Button>
    </EmailLayout>
  );
}
export const reviewPendingSubject = "We're reviewing your Mintly account";

/** To Mintly admins: a new trial needs reviewing (APPR-04). */
export function ReviewNeededAdminEmail({
  orgName,
  email,
  reviewUrl,
}: {
  orgName: string;
  email: string;
  reviewUrl: string;
}) {
  return (
    <EmailLayout preview={`New trial awaiting review: ${orgName}`}>
      <Text style={text}>
        A new trial is waiting for review.
        <br />
        Organisation: {orgName}
        <br />
        Owner: {email}
      </Text>
      <Button href={reviewUrl} style={button}>
        Review it
      </Button>
    </EmailLayout>
  );
}
export const reviewNeededAdminSubject = (orgName: string, email: string) =>
  `New trial awaiting review: ${orgName}, ${email}`;

/** To Mintly admins: trials have waited more than 4 working hours. */
export function ReviewReminderAdminEmail({
  reviews,
  queueUrl,
}: {
  reviews: Array<{ orgName: string; email: string; waiting: string }>;
  queueUrl: string;
}) {
  return (
    <EmailLayout preview={`${reviews.length} trial reviews are waiting`}>
      <Text style={text}>
        {reviews.length === 1 ? "A trial has" : `${reviews.length} trials have`} been waiting for
        review for more than 4 working hours:
      </Text>
      <Text style={text}>
        {reviews.map((r) => (
          <span key={r.email}>
            {r.orgName} ({r.email}), waiting {r.waiting}
            <br />
          </span>
        ))}
      </Text>
      <Text style={text}>Pending trials are declined automatically after 7 days.</Text>
      <Button href={queueUrl} style={button}>
        Open the review queue
      </Button>
    </EmailLayout>
  );
}
export const reviewReminderAdminSubject = (count: number) =>
  count === 1 ? "A trial review is waiting" : `${count} trial reviews are waiting`;

/** To the owner when approved (APPR-05, APPR-06). */
export function ReviewApprovedEmail({
  orgName,
  trialEnd,
  subscriptionUrl,
}: {
  orgName: string;
  trialEnd: string | null;
  subscriptionUrl: string;
}) {
  return (
    <EmailLayout preview="Your Mintly account is approved">
      <Text style={text}>Good news: we&apos;ve approved {orgName}&apos;s Mintly account.</Text>
      <Text style={text}>
        Your API key is ready on the subscription page, and the web tools now make live checks.
        {trialEnd ? ` Your free trial runs until ${trialEnd}.` : ""}
      </Text>
      <Button href={subscriptionUrl} style={button}>
        Get your API key
      </Button>
    </EmailLayout>
  );
}
export const reviewApprovedSubject = "Your Mintly account is approved";

/** The default request when asking for information. */
export const defaultInfoRequest =
  "To finish reviewing your account, please reply with your company's website and a sentence or two about how you'll use Mintly.";

/** To the owner when an admin needs more information (APPR-05). */
export function ReviewInfoRequestEmail({ orgName, message }: { orgName: string; message: string }) {
  return (
    <EmailLayout preview="We need a little more information">
      <Text style={text}>Thanks for starting a Mintly trial for {orgName}.</Text>
      <Text style={{ ...text, whiteSpace: "pre-line" }}>{message}</Text>
      <Text style={text}>
        Just reply to this email. Your trial starts as soon as we approve you.
      </Text>
    </EmailLayout>
  );
}
export const reviewInfoRequestSubject = "A question about your Mintly account";

/** To the owner when declined: short, polite, and gives no reason (plan §6.11). */
export function ReviewDeclinedEmail({ orgName }: { orgName: string }) {
  return (
    <EmailLayout preview="About your Mintly trial">
      <Text style={text}>
        Thank you for your interest in Mintly. We&apos;re sorry, but we&apos;re unable to offer{" "}
        {orgName} a trial at this time. You haven&apos;t been charged anything.
      </Text>
      <Text style={text}>
        If you think this is a mistake, email {siteConfig.supportEmail} and we&apos;ll take another
        look.
      </Text>
    </EmailLayout>
  );
}
export const reviewDeclinedSubject = "About your Mintly trial";

/** To the owner when the review expired after 7 days (APPR-07). */
export function ReviewExpiredEmail({ orgName }: { orgName: string }) {
  return (
    <EmailLayout preview="Your Mintly trial request has expired">
      <Text style={text}>
        We weren&apos;t able to finish reviewing {orgName}&apos;s trial request in time, so it has
        expired. You haven&apos;t been charged anything.
      </Text>
      <Text style={text}>
        If you&apos;d still like to try Mintly, email {siteConfig.supportEmail} and we&apos;ll get
        you started.
      </Text>
    </EmailLayout>
  );
}
export const reviewExpiredSubject = "Your Mintly trial request has expired";
