"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/auth/errors";

import { signIn } from "../actions";

export function SignInForm({
  next,
  linkError,
  defaultEmail,
  forgotHref,
}: {
  next: string;
  linkError?: string;
  defaultEmail?: string;
  forgotHref: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(signIn, {
    error: linkError,
    values: defaultEmail ? { email: defaultEmail } : undefined,
  });

  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <FormField
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
      />
      <div className="grid gap-2">
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Link href={forgotHref} className="justify-self-end text-sm text-primary hover:underline">
          Forgot your password?
        </Link>
      </div>
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
