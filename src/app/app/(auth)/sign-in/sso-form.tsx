"use client";

import Script from "next/script";
import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/auth/errors";

import { signInWithSso } from "../actions";

type Grecaptcha = {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

// reCAPTCHA v3 runs only when a site key is configured (SSO-02).
async function captchaToken(siteKey: string | null): Promise<string> {
  const grecaptcha = window.grecaptcha;
  if (!siteKey || !grecaptcha) return "";
  await new Promise<void>((resolve) => grecaptcha.ready(resolve));
  return grecaptcha.execute(siteKey, { action: "sso" }).catch(() => "");
}

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
      formData.set("captcha", await captchaToken(siteKey));
      return signInWithSso(previous, formData);
    },
    defaultEmail ? { values: { email: defaultEmail } } : {},
  );

  if (!open) {
    return (
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        Sign in with SSO
      </Button>
    );
  }

  return (
    <form action={action} className="grid gap-4" aria-label="Sign in with SSO">
      {siteKey ? (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`}
          strategy="afterInteractive"
        />
      ) : null}
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
      {siteKey ? (
        <p className="text-xs text-muted-foreground">
          Protected by reCAPTCHA. Google&apos;s{" "}
          <a href="https://policies.google.com/privacy" className="underline">
            Privacy Policy
          </a>{" "}
          and{" "}
          <a href="https://policies.google.com/terms" className="underline">
            Terms of Service
          </a>{" "}
          apply.
        </p>
      ) : null}
    </form>
  );
}
