"use client";

// Opens the Tawk.to chat if it has loaded; otherwise scrolls to the contact
// form, as the old site did, so the button never does nothing.
type TawkApi = { maximize?: () => void; toggle?: () => void; showWidget?: () => void };

export function openChat() {
  const tawk = (window as Window & { Tawk_API?: TawkApi }).Tawk_API;
  try {
    if (tawk?.maximize) {
      tawk.showWidget?.();
      tawk.maximize();
      return;
    }
  } catch {
    // Not ready yet; fall through.
  }
  document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
}
