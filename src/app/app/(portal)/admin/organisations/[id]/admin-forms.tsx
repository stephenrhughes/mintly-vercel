"use client";

import { useActionState, useState } from "react";

import {
  ActionResult,
  type ActionState,
  ConfirmCheckbox,
  selectClass,
  textareaClass,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/billing/format";
import type { ReviewStatus } from "@/lib/nav";

import { reinstateOrganisation, suspendOrganisation } from "../../reviews/actions";
import {
  applyPlanChange,
  cancelSubscriptionAction,
  changeRoleAction,
  extendTrialAction,
  inviteAction,
  type PlanChangeState,
  previewPlanChange,
  removeMemberAction,
  resendInviteAction,
  revokeInviteAction,
  rotateKeyAction,
  setExternalInvitesAction,
  setExtraSeatsAction,
  switchKeyOffAction,
  switchKeyOnAction,
  transferOwnershipAction,
  undoCancellationAction,
} from "./admin-actions";

// The admin's forms on an organisation (plan §6.8). Each runs one audited
// Server Action and shows its outcome next to it.

export type PriceChoice = {
  id: string;
  name: string;
  active: boolean;
  unitAmount: number | null;
  currency: string;
  interval: string | null;
  custom: boolean;
};

const priceLabel = (p: PriceChoice) =>
  `${p.name}: ${p.unitAmount === null ? "metered" : money(p.unitAmount, p.currency)}${p.interval ? ` a ${p.interval}` : ""} (${p.id})`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t pt-4 first:border-0 first:pt-0">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

// PLAN-09: any price, the trial, proration and timing; preview, then confirm.
export function PlanChangeForm({
  orgId,
  subscriptionId,
  prices,
  currentPriceId,
  trialing,
}: {
  orgId: string;
  subscriptionId: string;
  prices: PriceChoice[];
  currentPriceId: string;
  trialing: boolean;
}) {
  const [preview, previewAction] = useActionState<PlanChangeState, FormData>(
    previewPlanChange.bind(null, orgId, subscriptionId),
    {},
  );
  const [applied, applyAction] = useActionState<ActionState, FormData>(
    applyPlanChange.bind(null, orgId, subscriptionId),
    {},
  );
  const [trial, setTrial] = useState("keep");
  const q = preview.quote;

  return (
    <Section title="Change plan">
      <form action={previewAction} className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1 sm:col-span-2">
          <Label htmlFor="priceId">Price</Label>
          <select id="priceId" name="priceId" defaultValue={currentPriceId} className={selectClass}>
            {prices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === currentPriceId ? "Current: " : ""}
                {priceLabel(p)}
                {p.custom ? " [custom]" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="trial">Trial</Label>
          <select
            id="trial"
            name="trial"
            value={trial}
            onChange={(e) => setTrial(e.target.value)}
            className={selectClass}
          >
            <option value="keep">{trialing ? "Keep the trial" : "No trial change"}</option>
            {trialing ? <option value="end">End the trial now</option> : null}
            {trialing ? <option value="extend">Extend the trial</option> : null}
          </select>
        </div>
        {trial === "extend" ? (
          <div className="grid gap-1">
            <Label htmlFor="trialEnd">New trial end</Label>
            <Input id="trialEnd" name="trialEnd" type="date" required />
          </div>
        ) : null}
        <div className="grid gap-1">
          <Label htmlFor="proration">Proration</Label>
          <select
            id="proration"
            name="proration"
            defaultValue="create_prorations"
            className={selectClass}
          >
            <option value="none">None</option>
            <option value="create_prorations">Credit or charge on the next invoice</option>
            <option value="always_invoice">Charge or credit now</option>
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="when">When</Label>
          <select id="when" name="when" defaultValue="now" className={selectClass}>
            <option value="now">Now</option>
            <option value="renewal">At renewal</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <SubmitButton variant="outline" size="sm" pendingLabel="Asking Stripe…">
            Preview
          </SubmitButton>
        </div>
      </form>
      <ActionResult state={preview} />
      {q ? (
        <form action={applyAction} className="grid gap-3 rounded-md border p-4 text-sm">
          <p>
            Change to <strong>{q.planName}</strong>, effective {q.effective}.{" "}
            {q.today === null ? "Nothing is charged now." : `Stripe's preview: ${q.today} due now.`}
          </p>
          {q.warnings.length ? (
            <ul className="list-disc pl-5 text-destructive">
              {q.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {Object.entries(q.request).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="prorationDate" value={q.prorationDate} />
          <input type="hidden" name="nonce" value={q.nonce} />
          <ConfirmCheckbox label="Make this change in Stripe and email the owner" />
          <ActionResult state={applied} />
          <div>
            <SubmitButton size="sm" pendingLabel="Changing…">
              Confirm change
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </Section>
  );
}

// PLAN-11: only admins set extra seats.
export function ExtraSeatsForm({
  orgId,
  subscriptionId,
  extraUsers,
}: {
  orgId: string;
  subscriptionId: string;
  extraUsers: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    setExtraSeatsAction.bind(null, orgId, subscriptionId),
    {},
  );
  return (
    <Section title="Extra seats">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="extraUsers">On top of the plan&apos;s seats</Label>
          <Input
            id="extraUsers"
            name="extraUsers"
            type="number"
            min={0}
            max={1000}
            defaultValue={extraUsers}
            className="w-28"
          />
        </div>
        <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </form>
      <ActionResult state={state} />
    </Section>
  );
}

export function ExtendTrialForm({
  orgId,
  subscriptionId,
}: {
  orgId: string;
  subscriptionId: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    extendTrialAction.bind(null, orgId, subscriptionId),
    {},
  );
  return (
    <Section title="Extend the trial">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="extendTo">New trial end</Label>
          <Input id="extendTo" name="trialEnd" type="date" required />
        </div>
        <SubmitButton variant="outline" size="sm" pendingLabel="Extending…">
          Extend
        </SubmitButton>
      </form>
      <ActionResult state={state} />
    </Section>
  );
}

export function CancelForm({
  orgId,
  subscriptionId,
  cancelling,
}: {
  orgId: string;
  subscriptionId: string;
  cancelling: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    cancelSubscriptionAction.bind(null, orgId, subscriptionId),
    {},
  );
  const [undoState, undoAction] = useActionState<ActionState>(
    undoCancellationAction.bind(null, orgId, subscriptionId),
    {},
  );
  return (
    <Section title="Cancel">
      {cancelling ? (
        <form action={undoAction} className="grid gap-3">
          <p className="text-sm text-muted-foreground">The subscription is due to end.</p>
          <ActionResult state={undoState} />
          <div>
            <SubmitButton variant="outline" size="sm" pendingLabel="Undoing…">
              Keep the subscription
            </SubmitButton>
          </div>
        </form>
      ) : null}
      <form action={action} className="grid gap-3">
        <select
          name="when"
          defaultValue="period_end"
          className={`${selectClass} sm:w-72`}
          aria-label="When"
        >
          {!cancelling ? <option value="period_end">At the end of the period</option> : null}
          <option value="now">Now: the key goes off at once</option>
        </select>
        <ConfirmCheckbox label="I want to cancel this subscription" />
        <ActionResult state={state} />
        <div>
          <SubmitButton variant="destructive" size="sm" pendingLabel="Cancelling…">
            Cancel subscription
          </SubmitButton>
        </div>
      </form>
    </Section>
  );
}

// plan §6.8: API key operations. The value is never shown.
export function KeyForms({
  orgId,
  keyId,
  disabledByAdmin,
  canRotate,
}: {
  orgId: string;
  keyId: string;
  disabledByAdmin: boolean;
  canRotate: boolean;
}) {
  const [offState, offAction] = useActionState<ActionState, FormData>(
    switchKeyOffAction.bind(null, orgId, keyId),
    {},
  );
  const [onState, onAction] = useActionState<ActionState>(
    switchKeyOnAction.bind(null, orgId, keyId),
    {},
  );
  const [rotateState, rotateAction] = useActionState<ActionState, FormData>(
    rotateKeyAction.bind(null, orgId),
    {},
  );
  return (
    <div className="grid gap-4">
      {disabledByAdmin ? (
        <form action={onAction} className="grid gap-2">
          <ActionResult state={onState} />
          <div>
            <SubmitButton size="sm" pendingLabel="Switching on…">
              Switch the key back on
            </SubmitButton>
          </div>
        </form>
      ) : (
        <form action={offAction} className="grid gap-2">
          <Label htmlFor={`reason-${keyId}`}>Switch off: reason (kept in the audit log)</Label>
          <textarea id={`reason-${keyId}`} name="reason" className={textareaClass} required />
          <ConfirmCheckbox label="Switch this key off until an admin switches it on" />
          <ActionResult state={offState} />
          <div>
            <SubmitButton variant="destructive" size="sm" pendingLabel="Switching off…">
              Switch off
            </SubmitButton>
          </div>
        </form>
      )}
      {canRotate ? (
        <form action={rotateAction} className="grid gap-2 border-t pt-4">
          <Label htmlFor={`rotate-${keyId}`}>
            Rotate: a new key in the same usage plan; the owner is emailed
          </Label>
          <select
            id={`rotate-${keyId}`}
            name="when"
            defaultValue="overlap"
            className={`${selectClass} sm:w-72`}
          >
            <option value="overlap">Old key keeps working for 24 hours</option>
            <option value="now">Old key stops now</option>
          </select>
          <ConfirmCheckbox label="Replace this organisation's API key" />
          <ActionResult state={rotateState} />
          <div>
            <SubmitButton variant="outline" size="sm" pendingLabel="Rotating…">
              Rotate key
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}

// APPR-08 from the organisation page: suspend for abuse, or reinstate.
export function AccessForms({ orgId, status }: { orgId: string; status: ReviewStatus }) {
  const [suspendState, suspendAction] = useActionState<ActionState, FormData>(
    suspendOrganisation.bind(null, orgId),
    {},
  );
  const [reinstateState, reinstateAction] = useActionState<ActionState>(
    reinstateOrganisation.bind(null, orgId),
    {},
  );
  if (status === "approved") {
    return (
      <form action={suspendAction} className="grid gap-2">
        <Label htmlFor="suspend-reason">Suspend: reason (kept in the audit log)</Label>
        <textarea id="suspend-reason" name="reason" className={textareaClass} required />
        <ActionResult state={suspendState} />
        <div>
          <SubmitButton variant="destructive" size="sm" pendingLabel="Suspending…">
            Suspend
          </SubmitButton>
        </div>
      </form>
    );
  }
  if (status === "suspended") {
    return (
      <form action={reinstateAction} className="grid gap-2">
        <ActionResult state={reinstateState} />
        <div>
          <SubmitButton size="sm" pendingLabel="Reinstating…">
            Reinstate
          </SubmitButton>
        </div>
      </form>
    );
  }
  return null;
}

export function InviteForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(inviteAction.bind(null, orgId), {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
      <div className="grid gap-1">
        <Label htmlFor="invite-email">Invite by email</Label>
        <Input id="invite-email" name="email" type="email" required />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="invite-role">Role</Label>
        <select id="invite-role" name="role" defaultValue="member" className={selectClass}>
          <option value="member">Member</option>
          <option value="developer">Developer</option>
        </select>
      </div>
      <SubmitButton variant="outline" pendingLabel="Inviting…">
        Invite
      </SubmitButton>
      <div className="sm:col-span-3">
        <ActionResult state={state} />
      </div>
    </form>
  );
}

export function MemberForms({
  orgId,
  userId,
  role,
}: {
  orgId: string;
  userId: string;
  role: "developer" | "member";
}) {
  const [roleState, roleAction] = useActionState<ActionState, FormData>(
    changeRoleAction.bind(null, orgId, userId),
    {},
  );
  const [removeState, removeAction] = useActionState<ActionState, FormData>(
    removeMemberAction.bind(null, orgId, userId),
    {},
  );
  return (
    <div className="grid gap-2">
      <form action={roleAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="role" value={role === "developer" ? "member" : "developer"} />
        <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
          Make {role === "developer" ? "Member" : "Developer"}
        </SubmitButton>
      </form>
      <ActionResult state={roleState} />
      <form action={removeAction} className="flex flex-wrap items-center gap-2">
        <ConfirmCheckbox label="I'm sure" />
        <SubmitButton variant="destructive" size="sm" pendingLabel="Removing…">
          Remove
        </SubmitButton>
      </form>
      <ActionResult state={removeState} />
    </div>
  );
}

export function InviteRowForms({ orgId, inviteId }: { orgId: string; inviteId: string }) {
  const [resendState, resend] = useActionState<ActionState>(
    resendInviteAction.bind(null, orgId, inviteId),
    {},
  );
  const [revokeState, revoke] = useActionState<ActionState>(
    revokeInviteAction.bind(null, orgId, inviteId),
    {},
  );
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={resend}>
          <SubmitButton variant="outline" size="sm" pendingLabel="Sending…">
            Resend
          </SubmitButton>
        </form>
        <form action={revoke}>
          <SubmitButton variant="outline" size="sm" pendingLabel="Withdrawing…">
            Withdraw
          </SubmitButton>
        </form>
      </div>
      <ActionResult state={resendState} />
      <ActionResult state={revokeState} />
    </div>
  );
}

export function TransferForm({
  orgId,
  candidates,
}: {
  orgId: string;
  candidates: Array<{ userId: string; label: string }>;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    transferOwnershipAction.bind(null, orgId),
    {},
  );
  if (!candidates.length) return null;
  return (
    <form action={action} className="grid gap-2">
      <Label htmlFor="new-owner">Transfer ownership to</Label>
      <select id="new-owner" name="userId" className={`${selectClass} sm:w-80`}>
        {candidates.map((c) => (
          <option key={c.userId} value={c.userId}>
            {c.label}
          </option>
        ))}
      </select>
      <ConfirmCheckbox label="Make them the owner; the current owner becomes a Developer" />
      <ActionResult state={state} />
      <div>
        <SubmitButton variant="outline" size="sm" pendingLabel="Transferring…">
          Transfer ownership
        </SubmitButton>
      </div>
    </form>
  );
}

export function ExternalInvitesForm({ orgId, allowed }: { orgId: string; allowed: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(
    setExternalInvitesAction.bind(null, orgId),
    {},
  );
  return (
    <form action={action} className="grid gap-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="allow"
          defaultChecked={allowed}
          className="size-4 accent-primary"
        />
        The owner may invite people from other email domains
      </label>
      <ActionResult state={state} />
      <div>
        <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
