"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import type { ReviewStatus } from "@/lib/nav";

import {
  type ActionState,
  approveReview,
  askForInformationReview,
  declineReview,
  reinstateOrganisation,
  suspendOrganisation,
} from "../actions";

type Props = {
  orgId: string;
  status: ReviewStatus;
  domain: string | null;
  defaultQuestion: string;
};

function Result({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (!state.message) return null;
  return (
    <Alert variant="success">
      <CircleCheck aria-hidden />
      <AlertDescription className="text-secondary-foreground">
        {state.message}
        {state.warnings?.length ? (
          <ul className="mt-1 list-disc pl-4">
            {state.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} className="size-4 accent-primary" />
      {label}
    </label>
  );
}

const textarea =
  "min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

// APPR-05: approve, ask for information or decline a pending trial.
// APPR-08: suspend an approved organisation, or reinstate a suspended one.
export function ReviewForms({ orgId, status, domain, defaultQuestion }: Props) {
  const [approveState, approveAction] = useActionState<ActionState, FormData>(
    approveReview.bind(null, orgId),
    {},
  );
  const [askState, askAction] = useActionState<ActionState, FormData>(
    askForInformationReview.bind(null, orgId),
    {},
  );
  const [declineState, declineAction] = useActionState<ActionState, FormData>(
    declineReview.bind(null, orgId),
    {},
  );
  const [suspendState, suspendAction] = useActionState<ActionState, FormData>(
    suspendOrganisation.bind(null, orgId),
    {},
  );
  const [reinstateState, reinstateAction] = useActionState<ActionState, FormData>(
    reinstateOrganisation.bind(null, orgId),
    {},
  );

  // A decline whose Stripe cancellation failed can be retried.
  const canRetryDecline = status === "rejected" && Boolean(declineState.error);

  return (
    <div className="grid gap-6">
      {status === "pending_review" ? (
        <>
          <section aria-labelledby="approve-heading" className="grid gap-3">
            <h3 id="approve-heading" className="font-medium">
              Approve
            </h3>
            <p className="text-sm text-muted-foreground">
              Creates the API key in the trial usage plan, restarts the 14-day trial from today, and
              emails the owner.
            </p>
            <form action={approveAction} className="grid gap-3">
              <Result state={approveState} />
              {domain ? (
                <Checkbox
                  name="trustDomain"
                  label={`Also trust ${domain}, so future sign-ups from it are approved automatically`}
                />
              ) : null}
              <div>
                <SubmitButton pendingLabel="Approving…">Approve</SubmitButton>
              </div>
            </form>
          </section>

          <section aria-labelledby="ask-heading" className="grid gap-3 border-t pt-6">
            <h3 id="ask-heading" className="font-medium">
              Ask for more information
            </h3>
            <form action={askAction} className="grid gap-3">
              <Result state={askState} />
              <Label htmlFor="message">Email to the owner (replies come to support)</Label>
              <textarea
                id="message"
                name="message"
                defaultValue={defaultQuestion}
                className={textarea}
              />
              <div>
                <SubmitButton variant="outline" pendingLabel="Sending…">
                  Send
                </SubmitButton>
              </div>
            </form>
          </section>

          <section aria-labelledby="decline-heading" className="grid gap-3 border-t pt-6">
            <h3 id="decline-heading" className="font-medium">
              Decline
            </h3>
            <p className="text-sm text-muted-foreground">
              Cancels the Stripe trial at once (nothing is charged) and sends a short email that
              gives no reason.
            </p>
            <DeclineForm action={declineAction} state={declineState} domain={domain} />
          </section>
        </>
      ) : null}

      {canRetryDecline ? (
        <DeclineForm action={declineAction} state={declineState} domain={null} />
      ) : null}

      {status === "approved" ? (
        <section aria-labelledby="suspend-heading" className="grid gap-3">
          <h3 id="suspend-heading" className="font-medium">
            Suspend
          </h3>
          <p className="text-sm text-muted-foreground">
            For abuse found after approval. Turns the API key off and blocks the tools until the
            organisation is reinstated. The owner isn&apos;t emailed.
          </p>
          <form action={suspendAction} className="grid gap-3">
            <Result state={suspendState} />
            <Label htmlFor="reason">Reason (kept in the audit log)</Label>
            <textarea id="reason" name="reason" className={textarea} required />
            <div>
              <SubmitButton variant="destructive" pendingLabel="Suspending…">
                Suspend
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {status === "suspended" ? (
        <form action={reinstateAction} className="grid gap-3">
          <Result state={reinstateState} />
          <p className="text-sm text-muted-foreground">Turns the API key back on.</p>
          <div>
            <SubmitButton pendingLabel="Reinstating…">Reinstate</SubmitButton>
          </div>
        </form>
      ) : null}

      {status === "rejected" && !canRetryDecline ? (
        <p className="text-sm text-muted-foreground">
          This organisation was declined. Its trial was cancelled.
        </p>
      ) : null}
    </div>
  );
}

function DeclineForm({
  action,
  state,
  domain,
}: {
  action: (formData: FormData) => void;
  state: ActionState;
  domain: string | null;
}) {
  return (
    <form action={action} className="grid gap-3">
      <Result state={state} />
      {domain ? (
        <Checkbox
          name="blockDomain"
          label={`Also block ${domain}, so nobody can sign up from it`}
        />
      ) : null}
      <Checkbox name="confirm" label="I want to decline this trial" />
      <div>
        <SubmitButton variant="destructive" pendingLabel="Declining…">
          Decline
        </SubmitButton>
      </div>
    </form>
  );
}
