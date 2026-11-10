"use client";

import { MailPlus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/auth/errors";

import { invite, remove, resend, revoke, setRole } from "./actions";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

// TEAM-04, TEAM-07: the owner invites by email and chooses a role.
export function InviteForm({ domain }: { domain: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(invite, {});
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <FormField
          label="Email address"
          name="email"
          type="email"
          autoComplete="off"
          required
          placeholder={domain ? `name@${domain}` : "name@company.com"}
          defaultValue={state.message ? "" : state.values?.email}
          key={state.message ?? "invite"}
          error={state.fieldErrors?.email}
        />
        <div className="grid gap-2">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            className={selectClass}
            defaultValue={state.values?.role ?? "member"}
          >
            <option value="member">Member</option>
            <option value="developer">Developer</option>
          </select>
        </div>
        <SubmitButton pendingLabel="Sending…">
          <MailPlus aria-hidden /> Send invite
        </SubmitButton>
      </div>
      {state.fieldErrors?.role ? (
        <p className="text-sm text-destructive">{state.fieldErrors.role}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Members use the tools and see usage. Developers can also see and rotate the API key.
      </p>
    </form>
  );
}

function InlineMessage({ state }: { state: FormState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      role="status"
      className={state.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
    >
      {state.error ?? state.message}
    </p>
  );
}

export function InviteActions({ inviteId, email }: { inviteId: string; email: string }) {
  const [resendState, resendAction] = useActionState<FormState, FormData>(resend, {});
  const [revokeState, revokeAction] = useActionState<FormState, FormData>(revoke, {});
  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex gap-2">
        <form action={resendAction}>
          <input type="hidden" name="inviteId" value={inviteId} />
          <SubmitButton size="sm" variant="outline" pendingLabel="Sending…">
            Resend
          </SubmitButton>
        </form>
        <form action={revokeAction}>
          <input type="hidden" name="inviteId" value={inviteId} />
          <SubmitButton
            size="sm"
            variant="ghost"
            pendingLabel="Withdrawing…"
            aria-label={`Withdraw the invite to ${email}`}
          >
            Withdraw
          </SubmitButton>
        </form>
      </div>
      <InlineMessage state={resendState.error || resendState.message ? resendState : revokeState} />
    </div>
  );
}

export function MemberActions({
  userId,
  name,
  role,
}: {
  userId: string;
  name: string;
  role: "developer" | "member";
}) {
  const [roleState, roleAction] = useActionState<FormState, FormData>(setRole, {});
  const [removeState, removeAction] = useActionState<FormState, FormData>(remove, {});
  const [confirming, setConfirming] = useState(false);
  const other = role === "developer" ? "member" : "developer";

  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <form action={roleAction}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="role" value={other} />
          <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
            Make {other === "developer" ? "Developer" : "Member"}
          </SubmitButton>
        </form>
        {confirming ? null : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${name}`}
          >
            <Trash2 aria-hidden /> Remove
          </Button>
        )}
      </div>
      {confirming ? (
        <form action={removeAction} className="grid gap-2 rounded-md border p-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="confirm" className="mt-1 size-4 accent-primary" />
            <span>
              Remove {name}. They keep their login but lose access to your team&apos;s tools and
              usage.
            </span>
          </label>
          <input type="hidden" name="userId" value={userId} />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <SubmitButton size="sm" variant="destructive" pendingLabel="Removing…">
              Remove
            </SubmitButton>
          </div>
        </form>
      ) : null}
      <InlineMessage state={removeState.error || removeState.message ? removeState : roleState} />
    </div>
  );
}
