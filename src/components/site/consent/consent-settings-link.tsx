"use client";

import { openConsentSettings } from "@/components/site/consent/consent-store";

export function ConsentSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openConsentSettings} className={className}>
      Cookie settings
    </button>
  );
}
