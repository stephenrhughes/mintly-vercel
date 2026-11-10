"use client";

import { useActionState } from "react";

import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/auth/errors";
import { passwordHint } from "@/lib/auth/password";

import { signUp } from "../actions";

export function SignUpForm({
  next,
  defaultEmail,
  termsUrl,
  privacyUrl,
}: {
  next: string;
  defaultEmail?: string;
  termsUrl: string;
  privacyUrl: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    signUp,
    defaultEmail ? { values: { email: defaultEmail } } : {},
  );
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="First name"
          name="firstName"
          autoComplete="given-name"
          required
          defaultValue={values.firstName}
          error={errors.firstName}
        />
        <FormField
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          required
          defaultValue={values.lastName}
          error={errors.lastName}
        />
      </div>
      <FormField
        label="Company name"
        name="companyName"
        autoComplete="organization"
        required
        defaultValue={values.companyName}
        error={errors.companyName}
      />
      <FormField
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={values.email}
        error={errors.email}
        hint="Use your work address. Free email providers can't be used."
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={errors.password}
        hint={passwordHint}
      />
      <CheckboxField name="terms" required error={errors.terms}>
        I have read and accept the{" "}
        <a href={termsUrl} target="_blank" rel="noreferrer" className="text-primary underline">
          terms and conditions
        </a>{" "}
        and{" "}
        <a href={privacyUrl} target="_blank" rel="noreferrer" className="text-primary underline">
          privacy policy
        </a>
      </CheckboxField>
      <CheckboxField name="marketingOptOut">
        I don&apos;t want to receive product news and tips by email
      </CheckboxField>
      <SubmitButton className="w-full" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
    </form>
  );
}
