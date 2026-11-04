"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { authErrorMessage, type FormState, notConfiguredMessage } from "@/lib/auth/errors";
import { passwordProblems } from "@/lib/auth/password";
import { clearPendingEmail, getPendingEmail, setPendingEmail } from "@/lib/auth/pending-email";
import { isRecentEmailVerification } from "@/lib/auth/recovery";
import { authCallbackUrl } from "@/lib/auth/urls";
import { appPath, safeNextPath } from "@/lib/hosts";
import { legalDocuments } from "@/lib/legal";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const email = z.email({ error: "Enter a valid email address" }).max(254);

async function client() {
  return getSupabaseConfig() ? createClient() : null;
}

// AUTH-01, AUTH-10: sign in with email and password. A user with MFA turned
// on goes on to the code step (SEC-01).
export async function signIn(_state: FormState, formData: FormData): Promise<FormState> {
  const address = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(text(formData, "next"));
  const values = { email: address };

  if (!email.safeParse(address).success || !password) {
    return { error: "Enter your email and password.", values };
  }
  const supabase = await client();
  if (!supabase) return { error: notConfiguredMessage, values };

  const { error } = await supabase.auth.signInWithPassword({ email: address, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      await setPendingEmail(address);
      redirect(appPath(`/check-email?next=${encodeURIComponent(next)}`));
    }
    return { error: authErrorMessage(error), values };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect(appPath(`/sign-in/mfa?next=${encodeURIComponent(next)}`));
  }
  redirect(appPath(next));
}

const signUpSchema = z.object({
  firstName: z.string().min(1, "Enter your first name").max(100),
  lastName: z.string().min(1, "Enter your last name").max(100),
  companyName: z.string().min(1, "Enter your company name").max(200),
  email,
});

// AUTH-01 to AUTH-06, LEGAL-01: sign up with a work email, accept the terms
// and choose whether to get product emails.
export async function signUp(_state: FormState, formData: FormData): Promise<FormState> {
  const values = {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    companyName: text(formData, "companyName"),
    email: text(formData, "email").toLowerCase(),
  };
  const password = String(formData.get("password") ?? "");
  const termsAccepted = formData.get("terms") === "on";
  const marketingOptOut = formData.get("marketingOptOut") === "on";
  const next = safeNextPath(text(formData, "next"));

  const fieldErrors: Record<string, string> = {};
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] ??= issue.message;
    }
  }
  const problems = passwordProblems(password);
  if (problems.length > 0) fieldErrors.password = problems.join(". ");
  if (!termsAccepted) {
    fieldErrors.terms = "Please accept the terms and conditions and privacy policy";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  const supabase = await client();
  if (!supabase) return { error: notConfiguredMessage, values };

  // Work emails only (AUTH-04). The Auth hook enforces this too; asking first
  // gives the same message before anything is sent.
  const { data: emailError, error: rpcError } = await supabase.rpc("signup_email_error", {
    email: values.email,
  });
  if (rpcError) console.error("signup_email_error failed", rpcError.message);
  if (typeof emailError === "string") return { fieldErrors: { email: emailError }, values };

  const { error } = await supabase.auth.signUp({
    email: values.email,
    password,
    options: {
      emailRedirectTo: authCallbackUrl(next),
      data: {
        first_name: values.firstName,
        last_name: values.lastName,
        company_name: values.companyName,
        marketing_opt_out: marketingOptOut,
        terms_accepted: true,
        terms_version: legalDocuments.terms.version,
        privacy_version: legalDocuments.privacy.version,
      },
    },
  });
  if (error) return { error: authErrorMessage(error), values };

  await setPendingEmail(values.email);
  redirect(appPath(`/check-email?next=${encodeURIComponent(next)}`));
}

// AUTH-03: confirm the email address with the code from the email.
export async function confirmSignUp(_state: FormState, formData: FormData): Promise<FormState> {
  const address = (await getPendingEmail()) ?? text(formData, "email").toLowerCase();
  const code = text(formData, "code").replace(/\s/g, "");
  const next = safeNextPath(text(formData, "next"));

  if (!email.safeParse(address).success) {
    return { error: "Enter the email address you signed up with.", values: { email: address } };
  }
  if (!/^\d{6}$/.test(code)) {
    return { fieldErrors: { code: "Enter the 6-digit code from the email" } };
  }
  const supabase = await client();
  if (!supabase) return { error: notConfiguredMessage };

  const { error } = await supabase.auth.verifyOtp({ email: address, token: code, type: "email" });
  if (error) return { error: authErrorMessage(error) };

  await clearPendingEmail();
  redirect(appPath(next));
}

export async function resendSignUpCode(_state: FormState, formData: FormData): Promise<FormState> {
  const address = (await getPendingEmail()) ?? text(formData, "email").toLowerCase();
  const next = safeNextPath(text(formData, "next"));
  if (!email.safeParse(address).success) {
    return { error: "Enter the email address you signed up with." };
  }
  const supabase = await client();
  if (!supabase) return { error: notConfiguredMessage };

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: address,
    options: { emailRedirectTo: authCallbackUrl(next) },
  });
  if (error) return { error: authErrorMessage(error) };
  await setPendingEmail(address);
  return { message: "We've sent a new code. It can take a minute to arrive." };
}

// AUTH-12: password reset by email. The answer is the same whether or not
// the account exists, so the form can't be used to find accounts.
export async function requestPasswordReset(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const address = text(formData, "email").toLowerCase();
  if (!email.safeParse(address).success) {
    return { fieldErrors: { email: "Enter a valid email address" }, values: { email: address } };
  }
  const supabase = await client();
  if (!supabase) return { error: notConfiguredMessage, values: { email: address } };

  const { error } = await supabase.auth.resetPasswordForEmail(address, {
    redirectTo: authCallbackUrl("/reset-password"),
  });
  if (error && error.code?.startsWith("over_")) {
    return { error: authErrorMessage(error), values: { email: address } };
  }
  if (error) console.error("resetPasswordForEmail failed", error.code, error.message);

  await setPendingEmail(address);
  redirect(appPath("/reset-password?sent=1"));
}

export async function resetPassword(_state: FormState, formData: FormData): Promise<FormState> {
  const code = text(formData, "code").replace(/\s/g, "");
  const password = String(formData.get("password") ?? "");

  const problems = passwordProblems(password);
  if (problems.length > 0) return { fieldErrors: { password: problems.join(". ") } };

  const supabase = await client();
  if (!supabase) return { error: notConfiguredMessage };

  // Without a code, the user must have just arrived from the reset link,
  // which signed them in for this purpose.
  if (code) {
    const address = (await getPendingEmail()) ?? text(formData, "email").toLowerCase();
    if (!email.safeParse(address).success) {
      return { fieldErrors: { email: "Enter the email address the code was sent to" } };
    }
    const { error } = await supabase.auth.verifyOtp({
      email: address,
      token: code,
      type: "recovery",
    });
    if (error) return { error: authErrorMessage(error) };
  } else {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!isRecentEmailVerification(data?.currentAuthenticationMethods)) {
      return { fieldErrors: { code: "Enter the 6-digit code from the email" } };
    }
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "insufficient_aal") {
      redirect(appPath(`/sign-in/mfa?next=${encodeURIComponent("/reset-password")}`));
    }
    return { error: authErrorMessage(error) };
  }

  await clearPendingEmail();
  redirect(appPath("/?password=updated"));
}

// SEC-01: the second step of sign-in for users with an authenticator app.
export async function verifyMfa(_state: FormState, formData: FormData): Promise<FormState> {
  const code = text(formData, "code").replace(/\s/g, "");
  const next = safeNextPath(text(formData, "next"));
  if (!/^\d{6}$/.test(code)) {
    return { fieldErrors: { code: "Enter the 6-digit code from your authenticator app" } };
  }

  const supabase = await client();
  if (!supabase) return { error: notConfiguredMessage };

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) redirect(appPath(`/sign-in?next=${encodeURIComponent(next)}`));
  const factor = factors?.totp[0];
  if (!factor) redirect(appPath(next));

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: authErrorMessage(error) };
  redirect(appPath(next));
}
