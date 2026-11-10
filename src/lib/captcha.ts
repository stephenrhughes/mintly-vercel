// Google reCAPTCHA v3, checked on the server (plan §5, §6.1: SSO-02; the
// free checker and enquiry form use it in phase 6). Without
// RECAPTCHA_SECRET_KEY (local development, CI, previews without keys) the
// check is skipped, except on production, where it is required.

type Env = Record<string, string | undefined>;

export const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/** Scores below this are treated as bots. v3 scores run from 0.0 to 1.0. */
export const RECAPTCHA_MIN_SCORE = 0.5;

export function recaptchaSiteKey(env: Env = process.env): string | null {
  return env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() || null;
}

export type CaptchaResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: "missing" | "not_configured" | "rejected" | "unavailable" };

type VerifyResponse = {
  success?: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export async function verifyCaptcha(
  token: string | null | undefined,
  input: {
    action: string;
    /** Host names the page may be served from, such as app.mintly.uk. */
    hostnames: string[];
    remoteIp?: string | null;
  },
  deps: { env?: Env; fetch?: typeof fetch } = {},
): Promise<CaptchaResult> {
  const env = deps.env ?? process.env;
  const secret = env.RECAPTCHA_SECRET_KEY?.trim();
  if (!secret) {
    return env.VERCEL_ENV === "production"
      ? { ok: false, reason: "not_configured" }
      : { ok: true, skipped: true };
  }
  if (!token) return { ok: false, reason: "missing" };

  const body = new URLSearchParams({ secret, response: token });
  if (input.remoteIp) body.set("remoteip", input.remoteIp);

  let result: VerifyResponse;
  try {
    const response = await (deps.fetch ?? fetch)(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };
    result = (await response.json()) as VerifyResponse;
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const hostnames = input.hostnames.map((h) => h.toLowerCase().replace(/:\d+$/, ""));
  const passed =
    result.success === true &&
    result.action === input.action &&
    typeof result.score === "number" &&
    result.score >= RECAPTCHA_MIN_SCORE &&
    typeof result.hostname === "string" &&
    hostnames.includes(result.hostname.toLowerCase());
  return passed ? { ok: true, skipped: false } : { ok: false, reason: "rejected" };
}
