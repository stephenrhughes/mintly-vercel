"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { captchaToken, preloadRecaptcha } from "@/components/recaptcha";
import { RecaptchaNotice } from "@/components/recaptcha-notice";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/auth/errors";

import { signInWithSso } from "../actions";

// SSO-01: "Sign in with SSO" takes a work email; the server finds the
// identity provider for its domain.
export function SsoForm({
  next,
  siteKey,
  defaultOpen,
  defaultEmail,
}: {
  next: string;
  siteKey: string | null;
  defaultOpen?: boolean;
  defaultEmail?: string;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [state, action] = useActionState<FormState, FormData>(
    async (previous, formData) => {
      formData.set("captcha", await captchaToken("sso", siteKey));
      return signInWithSso(previous, formData);
    },
    defaultEmail ? { values: { email: defaultEmail } } : {},
  );

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          preloadRecaptcha(siteKey);
          setOpen(true);
        }}
      >
        Sign in with SSO
      </Button>
    );
  }

  return (
    <form action={action} className="grid gap-4" aria-label="Sign in with SSO">
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <FormField
        label="Work email for SSO"
        id="sso-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        hint="If your organisation signs in to Mintly through its identity provider."
      />
      <SubmitButton variant="outline" className="w-full" pendingLabel="Finding your sign-in…">
        Continue with SSO
      </SubmitButton>
      {siteKey ? <RecaptchaNotice /> : null}
    </form>
  );
}
