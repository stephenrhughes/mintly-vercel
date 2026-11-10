"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { EnquiryNoticeEmail, enquiryNoticeSubject } from "@/emails/enquiry-notice";
import { EnquiryReplyEmail, enquiryReplySubject } from "@/emails/enquiry-reply";
import { verifyCaptcha } from "@/lib/captcha";
import { adminNotifyEmail, sendEmail } from "@/lib/email/send";
import {
  type Answers,
  buildQualification,
  CONTACT,
  formatTranscript,
  getOutcome,
  getOutcomeId,
  getQuestion,
  getSummary,
  getVisibleQuestions,
} from "@/lib/enquiry/qualification";
import { clientIp } from "@/lib/free-check/server";
import { insertRow } from "@/lib/leads/store";

// LEAD-01: the qualification enquiry. The server rebuilds the transcript
// and outcome from the raw answers rather than trusting the browser's,
// stores the enquiry, emails the sales inbox (reply-to the enquirer) and
// sends the enquirer an auto-reply.

const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(254),
  company: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(50).optional().default(""),
  notes: z.string().trim().max(5000).optional().default(""),
});

const enquirySchema = z.object({
  answers: z.record(
    z.string().max(40),
    z.union([z.string().max(40), z.array(z.string().max(40)).max(10)]),
  ),
  contact: contactSchema,
  sourcePage: z.string().max(500).nullable().optional(),
  token: z.string().max(4000).optional(),
});

/** Keeps only answers to questions this person was shown, with known option values. */
function cleanAnswers(raw: Answers): Answers {
  const clean: Answers = {};
  for (const question of getVisibleQuestions(raw)) {
    if (question.id === CONTACT) continue;
    const values = new Set(getQuestion(question.id)?.options?.map((o) => o.value));
    const answer = raw[question.id];
    if (typeof answer === "string" && values.has(answer)) clean[question.id] = answer;
    if (Array.isArray(answer)) clean[question.id] = answer.filter((v) => values.has(v));
  }
  return clean;
}

export type EnquiryResult =
  { ok: true; outcomeId: string } | { ok: false; error: "invalid" | "captcha" | "failed" };

export async function submitEnquiry(input: z.input<typeof enquirySchema>): Promise<EnquiryResult> {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { contact, token } = parsed.data;
  const sourcePage = parsed.data.sourcePage ?? null;

  const h = await headers();
  const captcha = await verifyCaptcha(token, {
    action: "enquiry",
    hostnames: [h.get("x-forwarded-host") ?? h.get("host") ?? ""],
    remoteIp: clientIp(h) || null,
  });
  if (!captcha.ok) return { ok: false, error: "captcha" };

  const answers = cleanAnswers(parsed.data.answers);
  const outcome = getOutcome(answers);
  const qualification = buildQualification(answers, contact, sourcePage);

  const stored = await insertRow("enquiries", {
    name: contact.name,
    email: contact.email,
    company: contact.company,
    phone: contact.phone || null,
    message: contact.notes || null,
    answers: qualification,
    outcome: getOutcomeId(outcome),
    source_page: sourcePage,
  });

  // The emails are the part someone acts on, so a storage failure doesn't
  // stop them; it is logged by insertRow.
  try {
    await sendEmail({
      to: adminNotifyEmail(),
      subject: enquiryNoticeSubject(getSummary(answers), contact.name),
      react: EnquiryNoticeEmail({ transcript: formatTranscript(answers, contact), sourcePage }),
      replyTo: contact.email,
    });
  } catch (error) {
    console.error("Enquiry notice failed", error);
    if (!stored) return { ok: false, error: "failed" };
  }
  try {
    await sendEmail({
      to: contact.email,
      subject: enquiryReplySubject,
      react: EnquiryReplyEmail({ name: contact.name, outcome }),
    });
  } catch (error) {
    console.error("Enquiry auto-reply failed", error);
  }
  return { ok: true, outcomeId: getOutcomeId(outcome) };
}
