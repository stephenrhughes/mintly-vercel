"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/auth/errors";

import { acceptInvitation } from "./actions";

// Plan §6.6: an existing user is never moved without consent. Someone in
// another organisation must tick the box first.
export function AcceptForm({
  token,
  orgName,
  currentOrgName,
}: {
  token: string;
  orgName: string;
  currentOrgName: string | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(acceptInvitation, {});
  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="orgName" value={orgName} />
      {currentOrgName ? (
        <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <input type="checkbox" name="move" className="mt-1 size-4 accent-primary" />
          <span>
            Move me from {currentOrgName} to {orgName}. I&apos;ll lose access to {currentOrgName}
            &apos;s tools, usage and API key.
          </span>
        </label>
      ) : null}
      <SubmitButton className="w-full" pendingLabel="Joining…">
        Join {orgName}
      </SubmitButton>
    </form>
  );
}
