"use client";

import { useEffect } from "react";

/**
 * Makes every form in the page inert while an admin views as a customer
 * (ADM-13), including forms that appear later. Only a convenience: the
 * proxy refuses the writes anyway.
 */
export function ReadOnlyForms() {
  useEffect(() => {
    const main = document.getElementById("content");
    if (!main) return;
    const apply = () => {
      for (const form of main.querySelectorAll("form")) {
        if (!form.inert) form.inert = true;
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(main, { subtree: true, childList: true });
    return () => {
      observer.disconnect();
      for (const form of main.querySelectorAll("form")) form.inert = false;
    };
  }, []);
  return null;
}
