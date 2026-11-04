"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/auth/errors";
import { passwordHint } from "@/lib/auth/password";

import { resetPassword } from "../actions";

export function ResetPasswordForm({
  needsCode,
  needsEmail,
}: {
  needsCode: boolean;
  needsEmail: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(resetPassword, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      {needsEmail ? (
        <FormField
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={errors.email}
        />
      ) : null}
      {needsCode ? (
        <FormField
          label="Code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          error={errors.code}
          className="max-w-48"
        />
      ) : null}
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={errors.password}
        hint={passwordHint}
      />
      <SubmitButton className="w-full" pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
