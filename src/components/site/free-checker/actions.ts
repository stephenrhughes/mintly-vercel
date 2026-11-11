"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { verifyCaptcha } from "@/lib/captcha";
import { clientIp } from "@/lib/free-check/server";
import { insertRow } from "@/lib/leads/store";

// FREE-04: the free checker's 1-5 rating, with optional feedback. Server
// Actions get Next.js's origin check; reCAPTCHA keeps bots out.
const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(2000).optional(),
  token: z.string().max(4000).optional(),
});

export async function submitRating(input: z.input<typeof ratingSchema>): Promise<{ ok: boolean }> {
  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const h = await headers();
  const captcha = await verifyCaptcha(parsed.data.token, {
    action: "rating",
    hostnames: [h.get("x-forwarded-host") ?? h.get("host") ?? ""],
    remoteIp: clientIp(h) || null,
  });
  if (!captcha.ok) return { ok: false };
  const ok = await insertRow("tool_ratings", {
    rating: parsed.data.rating,
    feedback: parsed.data.feedback || null,
    source: "free-checker",
  });
  return { ok };
}
