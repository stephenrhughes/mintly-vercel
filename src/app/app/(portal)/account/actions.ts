"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { authErrorMessage, type FormState } from "@/lib/auth/errors";
import { passwordProblems } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/session";
import { createClient, createSessionlessClient } from "@/lib/supabase/server";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

const profileSchema = z.object({
  firstName: z.string().min(1, "Enter your first name").max(100),
  lastName: z.string().min(1, "Enter your last name").max(100),
  companyName: z.string().max(200),
  phone: z
    .string()
    .max(30)
    .refine((value) => value === "" || /^\+?[0-9 ()-]{7,}$/.test(value), {
      message: "Enter a phone number, for example +44 20 7946 0000",
    }),
});

// ACC-01, ACC-02, ACC-06, AUTH-06: a user edits their own contact details
// and marketing choice. RLS and column privileges stop them changing
// anything else, or anyone else's profile.
export async function updateProfile(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account");
  const values = {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    companyName: text(formData, "companyName"),
    phone: text(formData, "phone"),
  };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors, values };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: values.firstName,
      last_name: values.lastName,
      company_name: values.companyName || null,
      phone: values.phone || null,
      marketing_opt_out: formData.get("marketingOptOut") === "on",
    })
    .eq("id", user.id);
  if (error) {
    console.error("profile update failed", error.code, error.message);
    return { error: "We couldn't save your details. Please try again.", values };
  }

  refresh();
  return { message: "Your details have been saved.", values };
}

// ACC-03: change password, after confirming the current one. Not offered to
// SSO users (SSO-06).
export async function changePassword(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account");
  if (user.isSso) return { error: "Your password is managed by your organisation's sign-in." };

  const current = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const problems = passwordProblems(password);
  if (!current) return { fieldErrors: { currentPassword: "Enter your current password" } };
  if (problems.length > 0) return { fieldErrors: { password: problems.join(". ") } };

  // Check the current password without touching this browser's session.
  const checker = createSessionlessClient();
  const { error: checkError } = await checker.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (checkError) {
    return checkError.code === "invalid_credentials"
      ? { fieldErrors: { currentPassword: "That isn't your current password" } }
      : { error: authErrorMessage(checkError) };
  }
  await checker.auth.signOut({ scope: "local" });

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error) };
  return { message: "Your password has been changed." };
}

export type EnrollmentState = FormState & {
  factorId?: string;
  qrCode?: string;
  secret?: string;
  done?: boolean;
};

// SEC-01: set up an authenticator app. Step 1 creates an unverified factor
// and returns its QR code; step 2 confirms it with a code from the app,
// which also raises this session to aal2.
export async function startMfaEnrollment(): Promise<EnrollmentState> {
  const user = await requireUser("/account/security");
  const supabase = await createClient();

  // Clear any set-up that was started and not finished.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Mintly",
    friendlyName: `Authenticator app (${new Date().toISOString().slice(0, 10)})`,
  });
  if (error || !data) {
    console.error("mfa enroll failed", user.id, error?.code, error?.message);
    return { error: authErrorMessage(error) };
  }
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmMfaEnrollment(
  state: EnrollmentState,
  formData: FormData,
): Promise<EnrollmentState> {
  await requireUser("/account/security");
  const factorId = text(formData, "factorId");
  const code = text(formData, "code").replace(/\s/g, "");
  if (!factorId) return { error: "Start the set-up again." };
  if (!/^\d{6}$/.test(code)) {
    return { ...state, fieldErrors: { code: "Enter the 6-digit code from your app" } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { ...state, fieldErrors: { code: authErrorMessage(error) } };

  refresh();
  return { done: true, message: "Two-step verification is on." };
}

export async function removeMfaFactor(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account/security");
  const factorId = text(formData, "factorId");
  const supabase = await createClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp ?? [];
  if (!verified.some((factor) => factor.id === factorId))
    return { error: "That app isn't set up." };
  // Admins must always have MFA (SEC-01).
  if (user.isMintlyAdmin && verified.length <= 1) {
    return { error: "Mintly admins must keep an authenticator app. Add another one first." };
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: authErrorMessage(error) };

  // Removing a factor leaves the session at aal2 until it next refreshes.
  await supabase.auth.refreshSession();
  refresh();
  return { message: "The authenticator app has been removed." };
}
