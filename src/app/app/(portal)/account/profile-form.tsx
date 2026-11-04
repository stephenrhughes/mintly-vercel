"use client";

import { useActionState } from "react";

import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/auth/errors";

import { updateProfile } from "./actions";

type Defaults = {
  firstName: string;
  lastName: string;
  companyName: string;
  phone: string;
  marketingOptOut: boolean;
};

export function ProfileForm({ defaults }: { defaults: Defaults }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  const errors = state.fieldErrors ?? {};
  const values = { ...defaults, ...state.values };

  return (
    <form action={action} className="grid max-w-xl gap-5" noValidate>
      <FormMessage state={state} />
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
        defaultValue={values.companyName}
        error={errors.companyName}
      />
      <FormField
        label="Phone (optional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={values.phone}
        error={errors.phone}
        hint="Include the country code if you're outside the UK, for example +1 212 555 0100."
      />
      <CheckboxField name="marketingOptOut" defaultChecked={defaults.marketingOptOut}>
        I don&apos;t want to receive product news and tips by email
      </CheckboxField>
      <div>
        <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
      </div>
    </form>
  );
}
