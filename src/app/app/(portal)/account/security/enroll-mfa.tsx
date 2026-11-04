"use client";

import { useActionState, useState, useTransition } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";

import { confirmMfaEnrollment, type EnrollmentState, startMfaEnrollment } from "../actions";

export function EnrollMfa({ hasFactors }: { hasFactors: boolean }) {
  const [started, setStarted] = useState<EnrollmentState | null>(null);
  const [isStarting, startTransition] = useTransition();
  const [state, action] = useActionState<EnrollmentState, FormData>(confirmMfaEnrollment, {});

  if (state.done) return <FormMessage state={state} />;

  if (!started?.factorId) {
    return (
      <div className="grid justify-items-start gap-3">
        {started?.error ? <FormMessage state={started} /> : null}
        <Button
          type="button"
          variant={hasFactors ? "outline" : "default"}
          disabled={isStarting}
          onClick={() => startTransition(async () => setStarted(await startMfaEnrollment()))}
        >
          {hasFactors ? "Add another authenticator app" : "Set up an authenticator app"}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 rounded-lg border p-4 sm:grid-cols-[auto_1fr] sm:p-6">
      {/* The QR code is an SVG data URL from Supabase Auth. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={started.qrCode}
        alt="QR code to scan with your authenticator app"
        width={176}
        height={176}
        className="rounded-md border bg-white p-2"
      />
      <div className="grid content-start gap-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Scan the QR code with your authenticator app.</li>
          <li>
            Can&apos;t scan it? Enter this key instead:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
              {started.secret}
            </code>
          </li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        <form action={action} className="grid gap-4">
          <FormMessage state={state} />
          <input type="hidden" name="factorId" value={started.factorId} />
          <FormField
            label="Code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            error={state.fieldErrors?.code}
            className="max-w-48"
          />
          <div className="flex gap-3">
            <SubmitButton pendingLabel="Checking…">Turn on</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setStarted(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
