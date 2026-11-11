"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { addLead } from "@/lib/brevo";
import { verifyCaptcha } from "@/lib/captcha";
import { clientIp } from "@/lib/free-check/server";
import { createServiceClient, getServiceKey } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";

// LEAD-02: the BACS checklist download on /links adds the visitor to the
// Brevo lead list. Work emails only, using the same denylist as sign-up
// (signup_email_error), and reCAPTCHA, which the old form didn't have.

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(254),
  token: z.string().max(4000).optional(),
});

export type CaptureResult = { ok: true } | { ok: false; error: string };

async function emailProblem(email: string): Promise<string | null> {
  if (!getSupabaseConfig() || !getServiceKey()) return null;
  const { data, error } = await createServiceClient().rpc("signup_email_error", { email });
  if (error) {
    console.error("signup_email_error failed", error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

export async function captureEmail(input: z.input<typeof schema>): Promise<CaptureResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Please enter your name and a valid work email address." };

  const h = await headers();
  const captcha = await verifyCaptcha(parsed.data.token, {
    action: "email_capture",
    hostnames: [h.get("x-forwarded-host") ?? h.get("host") ?? ""],
    remoteIp: clientIp(h) || null,
  });
  if (!captcha.ok)
    return { ok: false, error: "We couldn't confirm you're not a robot. Please try again." };

  const problem = await emailProblem(parsed.data.email);
  if (problem) return { ok: false, error: "Please enter a valid work email address." };

  try {
    await addLead(parsed.data.email, parsed.data.name);
  } catch (error) {
    console.error("Adding a lead to Brevo failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  return { ok: true };
}
