"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  onConsentSettingsOpen,
  saveConsent,
  useConsent,
} from "@/components/site/consent/consent-store";
import { Button } from "@/components/ui/button";
import { ALL_CONSENT, type Consent, NO_CONSENT } from "@/lib/consent";

// The redesigned cookie banner (WEB-06). Accept all, Reject all, or choose
// per category; the footer's "Cookie settings" reopens it.
export function ConsentBanner() {
  const consent = useConsent();
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [draft, setDraft] = useState<Consent>(NO_CONSENT);

  useEffect(
    () =>
      onConsentSettingsOpen(() => {
        setDraft(consent ?? NO_CONSENT);
        setChoosing(true);
        setOpen(true);
      }),
    [consent],
  );

  // Before hydration (undefined) nothing shows; with no choice yet, it does.
  const visible = open || consent === null;
  if (!visible) return null;

  const decide = (choice: Consent) => {
    saveConsent(choice);
    setOpen(false);
    setChoosing(false);
  };

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6"
    >
      <div className="mx-auto max-w-3xl rounded-xl border bg-background p-5 shadow-2xl">
        <h2 id="consent-title" className="font-semibold">
          Cookies on Mintly
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We use essential cookies to make this site work. With your permission we&apos;d also like
          to use analytics cookies to understand how the site is used, and marketing cookies to
          measure our advertising. See our{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            privacy notice
          </Link>
          .
        </p>
        {choosing && (
          <fieldset className="mt-4 space-y-3 text-sm">
            <legend className="sr-only">Cookie categories</legend>
            <label className="flex items-start gap-3">
              <input type="checkbox" checked disabled className="mt-1" />
              <span>
                <span className="font-medium">Essential</span>
                <span className="block text-muted-foreground">
                  Needed for the site, sign-in and the free checker. Always on.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.analytics}
                onChange={(event) => setDraft({ ...draft, analytics: event.target.checked })}
              />
              <span>
                <span className="font-medium">Analytics</span>
                <span className="block text-muted-foreground">
                  Google Analytics and Microsoft Clarity, to see which pages help.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.marketing}
                onChange={(event) => setDraft({ ...draft, marketing: event.target.checked })}
              />
              <span>
                <span className="font-medium">Marketing</span>
                <span className="block text-muted-foreground">
                  Google Ads and Meta, to measure which adverts bring visitors.
                </span>
              </span>
            </label>
          </fieldset>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => decide(ALL_CONSENT)}>
            Accept all
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide(NO_CONSENT)}>
            Reject all
          </Button>
          {choosing ? (
            <Button size="sm" variant="ghost" onClick={() => decide(draft)}>
              Save choices
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setChoosing(true)}>
              Choose
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
