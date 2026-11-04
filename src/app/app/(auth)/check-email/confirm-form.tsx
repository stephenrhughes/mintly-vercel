"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/auth/errors";

import { confirmSignUp, resendSignUpCode } from "../actions";

export function ConfirmForm({ next, needsEmail }: { next: string; needsEmail: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(confirmSignUp, {});
  const [resendState, resendAction] = useActionState<FormState, FormData>(resendSignUpCode, {});

  return (
    <div className="grid gap-6">
      <form action={action} className="grid gap-5">
        <FormMessage state={state} />
        <input type="hidden" name="next" value={next} />
        {needsEmail ? (
          <FormField
            label="Work email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values?.email}
          />
        ) : null}
        <FormField
          label="Code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          error={state.fieldErrors?.code}
          className="max-w-48"
        />
        <SubmitButton className="w-full" pendingLabel="Confirming…">
          Confirm email
        </SubmitButton>
      </form>
      {needsEmail ? null : (
        <form action={resendAction} className="grid justify-items-start gap-3 border-t pt-5">
          <FormMessage state={resendState} />
          <input type="hidden" name="next" value={next} />
          <p className="text-sm text-muted-foreground">Didn&apos;t get a code?</p>
          <SubmitButton variant="outline" pendingLabel="Sending…">
            Send a new code
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
