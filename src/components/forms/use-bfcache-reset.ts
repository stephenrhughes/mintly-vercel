"use client";

import { useEffect, useState } from "react";

/**
 * A key that changes when the page is restored from the back/forward cache,
 * for example coming back from Stripe Checkout or the billing portal with
 * the browser's back button. Give it to a form as its `key` so the form
 * remounts and its button isn't stuck on "please wait" (BILL-03).
 */
export function useBfcacheReset(): number {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setGeneration((n) => n + 1);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  return generation;
}
