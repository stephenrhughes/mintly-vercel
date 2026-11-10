"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { useBfcacheReset } from "@/components/forms/use-bfcache-reset";

import { openBillingPortal, type PortalState } from "./actions";

// BILL-01, BILL-03: opens the Stripe billing portal, and isn't left stuck
// on "Opening…" when the owner comes back with the back button.
export function BillingPortalButton() {
  const generation = useBfcacheReset();
  const [state, action] = useActionState<PortalState, FormData>(openBillingPortal, {});
  return (
    <form action={action} key={generation} className="grid gap-2">
      <SubmitButton variant="outline" pendingLabel="Opening billing…">
        Manage billing and invoices
      </SubmitButton>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
