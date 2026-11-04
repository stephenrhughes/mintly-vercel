"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/auth/errors";
import { passwordHint } from "@/lib/auth/password";

import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePassword, {});
  const errors = state.fieldErrors ?? {};

  return (
    // Keyed on the message so the fields clear after a successful change.
    <form key={state.message} action={action} className="grid max-w-xl gap-5">
      <FormMessage state={state} />
      <FormField
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        error={errors.currentPassword}
      />
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={errors.password}
        hint={passwordHint}
      />
      <div>
        <SubmitButton pendingLabel="Saving…">Change password</SubmitButton>
      </div>
    </form>
  );
}
