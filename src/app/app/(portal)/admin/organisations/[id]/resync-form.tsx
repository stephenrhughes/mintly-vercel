"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { type ActionState, ActionResult } from "@/components/admin/ui";

import { applyResyncAction, previewResyncAction, type ResyncState } from "./actions";

// ADM-05: preview what a resync would change, then apply it.
export function ResyncForm({ orgId, subscriptionId }: { orgId: string; subscriptionId: string }) {
  const [preview, previewAction] = useActionState<ResyncState>(
    previewResyncAction.bind(null, orgId, subscriptionId),
    {},
  );
  const [applied, applyAction] = useActionState<ActionState, FormData>(
    applyResyncAction.bind(null, orgId, subscriptionId),
    {},
  );
  const p = preview.preview;
  const nothing = p && !p.changes.length && !p.keyActions.length && !p.blockers.length;

  return (
    <div className="grid gap-3">
      <form action={previewAction}>
        <SubmitButton variant="outline" size="sm" pendingLabel="Checking Stripe…">
          Preview resync from Stripe
        </SubmitButton>
      </form>
      <ActionResult state={preview} />
      {p ? (
        <div className="grid gap-3 rounded-md border p-4 text-sm">
          {p.blockers.length ? (
            <div>
              <p className="font-medium text-destructive">Can&apos;t resync</p>
              <ul className="list-disc pl-5">
                {p.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {nothing ? <p>Everything already matches Stripe.</p> : null}
          {p.changes.length ? (
            <div>
              <p className="font-medium">Record changes</p>
              <ul className="list-disc pl-5">
                {p.changes.map((c) => (
                  <li key={c.label}>
                    {c.label}: {c.stored ?? "empty"} → {c.expected ?? "empty"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {p.keyActions.length ? (
            <div>
              <p className="font-medium">Key actions (run first)</p>
              <ul className="list-disc pl-5">
                {p.keyActions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!p.blockers.length ? (
            <form action={applyAction} className="grid gap-3">
              <input type="hidden" name="fingerprint" value={p.fingerprint} />
              <ActionResult state={applied} />
              <div>
                <SubmitButton size="sm" pendingLabel="Resyncing…">
                  Apply resync
                </SubmitButton>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
