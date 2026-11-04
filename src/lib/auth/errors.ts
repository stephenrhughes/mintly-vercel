import type { AuthError } from "@supabase/supabase-js";

import { siteConfig } from "@/lib/site";

// Friendly wording for Supabase Auth errors. Unknown errors fall back to
// Supabase's own message, which is written for end users.
const messages: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Check them and try again.",
  email_not_confirmed: "Confirm your email address first. Enter the code we sent you.",
  user_already_exists: "An account with this email already exists. Sign in instead.",
  weak_password:
    "Choose a stronger password: at least 8 characters, with upper and lower case letters, a number and a symbol.",
  same_password: "Your new password must be different from your current one.",
  otp_expired: "That code has expired or is wrong. Ask for a new one and try again.",
  over_email_send_rate_limit: "We've sent several emails already. Wait a minute and try again.",
  over_request_rate_limit: "Too many attempts. Wait a minute and try again.",
  mfa_verification_failed: "That code isn't right. Check your authenticator app and try again.",
  signup_disabled: `Sign-up is closed at the moment. Email ${siteConfig.supportEmail} for help.`,
  email_address_invalid: "Enter a valid email address.",
};

export function authErrorMessage(error: Pick<AuthError, "message" | "code"> | null): string {
  if (!error) return "Something went wrong. Please try again.";
  return (error.code && messages[error.code]) || error.message;
}

export const notConfiguredMessage = `Sign-in isn't available on this deployment yet. Email ${siteConfig.supportEmail} for help.`;

/** What a form's Server Action returns to the form. */
export type FormState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Values to put back in the form after an error (never passwords). */
  values?: Record<string, string>;
};
