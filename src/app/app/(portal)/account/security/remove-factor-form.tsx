"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/auth/errors";

import { removeMfaFactor } from "../actions";

export function RemoveFactorForm({ factorId }: { factorId: string }) {
  const [state, action] = useActionState<FormState, FormData>(removeMfaFactor, {});
  return (
    <form
      action={action}
      className="grid justify-items-end gap-2"
      onSubmit={(event) => {
        if (!window.confirm("Remove this authenticator app?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="factorId" value={factorId} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Removing…">
        Remove
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
