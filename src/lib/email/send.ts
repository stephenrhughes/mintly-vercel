import "server-only";

import { render } from "@react-email/components";
import type * as React from "react";
import { Resend } from "resend";

import { siteConfig } from "@/lib/site";

// Transactional email through Resend (Q7, plan §5). Without RESEND_API_KEY
// (local development, CI) the email is logged instead of sent, so flows can
// be tried without an account.

type Env = Record<string, string | undefined>;

export function emailFrom(env: Env = process.env): string {
  return env.EMAIL_FROM?.trim() || `Mintly <no-reply@mintly.uk>`;
}

/** Where notices for Mintly staff go (AUTH-07, PROV-02). */
export function adminNotifyEmail(env: Env = process.env): string {
  return env.ADMIN_NOTIFY_EMAIL?.trim() || siteConfig.supportEmail;
}

let client: Resend | null = null;

export async function sendEmail({
  to,
  subject,
  react,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  replyTo?: string;
}): Promise<void> {
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0) return;

  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.info(
      `[email] not sent (RESEND_API_KEY unset): "${subject}" to ${recipients.join(", ")}`,
    );
    return;
  }

  const [html, text] = await Promise.all([render(react), render(react, { plainText: true })]);
  client ??= new Resend(key);
  const { error } = await client.emails.send({
    from: emailFrom(),
    to: recipients,
    subject,
    html,
    text,
    ...(replyTo ? { replyTo } : {}),
  });
  if (error) throw new Error(`Resend refused "${subject}": ${error.message}`);
}
