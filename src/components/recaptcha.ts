"use client";

// reCAPTCHA v3 in the browser (plan §5), shared by SSO sign-in, the free
// checker, the enquiry form, ratings and the email capture. The script is
// only fetched when a form first needs a token, so pages don't pay for it
// on load. Without a site key (development, CI) tokens are empty and the
// server skips the check, except on production.

type Grecaptcha = {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

// Referenced literally so Next.js inlines it.
export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() || null;

let loading: Promise<Grecaptcha | null> | null = null;

function load(siteKey: string): Promise<Grecaptcha | null> {
  if (window.grecaptcha) return Promise.resolve(window.grecaptcha);
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.onload = () => resolve(window.grecaptcha ?? null);
    script.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Starts loading early, for example when someone focuses a form. */
export function preloadRecaptcha(siteKey: string | null = RECAPTCHA_SITE_KEY) {
  if (siteKey && typeof window !== "undefined") void load(siteKey);
}

/** A token for one action, or "" when reCAPTCHA isn't configured or can't load. */
export async function captchaToken(
  action: string,
  siteKey: string | null = RECAPTCHA_SITE_KEY,
): Promise<string> {
  if (!siteKey) return "";
  const grecaptcha = await load(siteKey);
  if (!grecaptcha) return "";
  await new Promise<void>((resolve) => grecaptcha.ready(resolve));
  return grecaptcha.execute(siteKey, { action }).catch(() => "");
}
