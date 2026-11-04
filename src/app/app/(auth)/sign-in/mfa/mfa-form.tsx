"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/auth/errors";

import { verifyMfa } from "../../actions";

export function MfaForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(verifyMfa, {});
  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <FormField
        label="Code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        required
        autoFocus
        error={state.fieldErrors?.code}
        className="max-w-48"
      />
      <SubmitButton className="w-full" pendingLabel="Checking…">
        Continue
      </SubmitButton>
    </form>
  );
}
