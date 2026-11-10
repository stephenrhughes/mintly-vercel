"use client";

import { RefreshCw } from "lucide-react";
import { useActionState, useState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";

import { type RotateState, rotateApiKey } from "./actions";

// KEY-01: replace a leaked or old key without waiting for Mintly.
export function RotateKeyForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<RotateState, FormData>(rotateApiKey, {});

  if (!open && !state.message) {
    return (
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <RefreshCw aria-hidden /> Rotate key
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-3 rounded-lg border p-4">
      <FormMessage state={state} />
      {state.message ? null : (
        <>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">
              When should the current key stop working?
            </legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="when"
                value="overlap"
                defaultChecked
                className="mt-1 accent-primary"
              />
              <span>
                In 24 hours
                <span className="block text-muted-foreground">
                  Both keys work meanwhile, so you can update your integrations.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="when" value="now" className="mt-1 accent-primary" />
              <span>
                Straight away
                <span className="block text-muted-foreground">
                  For a key that has leaked. Anything using it stops working now.
                </span>
              </span>
            </label>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" className="size-4 accent-primary" />I understand
            integrations need the new key. The account owner will be emailed.
          </label>
          <div className="flex flex-wrap gap-2">
            <SubmitButton size="sm" pendingLabel="Replacing the key…">
              Replace the key
            </SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
