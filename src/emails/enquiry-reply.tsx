import { Button, Text } from "@react-email/components";

import type { Outcome } from "@/lib/enquiry/qualification";
import { PLANS } from "@/lib/billing/plans";
import { siteConfig } from "@/lib/site";

import { EmailLayout, text } from "./layout";

// LEAD-01: the auto-reply to an enquiry, saying what we'd recommend. The
// old reply promised "limited daily checks"; this one says what the new
// trial and plans actually are.
const button = {
  backgroundColor: "#0f766e",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "15px",
  padding: "12px 20px",
};

export function EnquiryReplyEmail({ name, outcome }: { name: string; outcome: Outcome }) {
  const plan = outcome.type === "plan" ? PLANS[outcome.plan] : null;
  return (
    <EmailLayout preview="Thanks for your enquiry">
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>
        Thanks for getting in touch with Mintly. We&apos;ve got your answers and someone from the
        team will reply, usually within one working day.
      </Text>
      {plan && (
        <>
          <Text style={text}>
            From what you told us, the {plan.name} fits: {plan.monthlyPrice} a month covers{" "}
            {plan.includedRequests} checks, then {plan.pricePerRequest} each. Every plan starts with
            a 14-day free trial, and you don&apos;t need a card to begin.
          </Text>
          <Button href={`${siteConfig.canonicalUrl}/pricing`} style={button}>
            Start your free trial
          </Button>
        </>
      )}
      {outcome.type === "call" && (
        <Text style={text}>
          {outcome.meeting === "eiscd"
            ? "Licensing the EISCD depends on how you'll use it, how often you need it and how many sites it covers, so we'll put a price together for you."
            : "At your volume, or with your requirements, it's worth a short call so we can get the details right."}{" "}
          If you&apos;d like to pick a time now, use the booking link on our website.
        </Text>
      )}
      {outcome.type === "enquiry" && (
        <Text style={text}>
          We&apos;ll come back to you with a recommendation. In the meantime you can try our free
          sort code checker, or read the API documentation.
        </Text>
      )}
      <Text style={text}>
        Useful links: {siteConfig.canonicalUrl}/sort-code-checker · {siteConfig.canonicalUrl}/docs ·{" "}
        {siteConfig.canonicalUrl}/faq
      </Text>
      <Text style={text}>The Mintly team</Text>
    </EmailLayout>
  );
}

export const enquiryReplySubject = "Thanks for your enquiry";
