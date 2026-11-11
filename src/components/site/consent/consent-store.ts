"use client";

import { useSyncExternalStore } from "react";

import { type Consent, consentCookie, consentFromCookies } from "@/lib/consent";

// The visitor's consent choice as a tiny external store, so the banner,
// the script loader and the settings link all agree without a context
// provider. The server snapshot is "unknown", so static pages render the
// same for everyone and the banner appears after hydration.

const CHANGE_EVENT = "mintly:consent-change";
const OPEN_EVENT = "mintly:consent-open";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

let cachedCookie: string | null = null;
let cachedConsent: Consent | null = null;

function read(): Consent | null {
  // useSyncExternalStore needs a stable snapshot between changes.
  if (document.cookie !== cachedCookie) {
    cachedCookie = document.cookie;
    cachedConsent = consentFromCookies(document.cookie);
  }
  return cachedConsent;
}

/** undefined on the server and before hydration; null when not chosen yet. */
export function useConsent(): Consent | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

export function saveConsent(consent: Consent) {
  document.cookie = consentCookie(consent, window.location.protocol === "https:");
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Reopens the banner from the footer's "Cookie settings" link. */
export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onConsentSettingsOpen(handler: () => void) {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}

/** The current choice outside React, for analytics calls. */
export function currentConsent(): Consent | null {
  return typeof document === "undefined" ? null : read();
}
