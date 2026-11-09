"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { useBfcacheReset } from "@/components/forms/use-bfcache-reset";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { type ChangeState, confirmPlanChange } from "./actions";

type Props = {
  tier: string;
  interval: string;
  mode: "switch" | "start_paid";
  prorationDate: number;
  nonce: string;
  label: string;
};

// The nonce makes a double click one change (plan §6.12: idempotency).
export function ConfirmForm({ tier, interval, mode, prorationDate, nonce, label }: Props) {
  const generation = useBfcacheReset();
  const [state, action] = useActionState<ChangeState, FormData>(confirmPlanChange, {});
  return (
    <form action={action} key={generation} className="grid gap-3">
      {state.error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="tier" value={tier} />
      <input type="hidden" name="interval" value={interval} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="prorationDate" value={prorationDate} />
      <input type="hidden" name="nonce" value={nonce} />
      <div>
        <SubmitButton pendingLabel="Changing your plan…">{label}</SubmitButton>
      </div>
    </form>
  );
}
