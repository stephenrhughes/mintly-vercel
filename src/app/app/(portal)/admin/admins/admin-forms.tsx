"use client";

import { useActionState } from "react";

import { ActionResult, type ActionState, ConfirmCheckbox } from "@/components/admin/ui";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { grantAdmin, revokeAdmin } from "./actions";

export function GrantForm() {
  const [state, action] = useActionState<ActionState, FormData>(grantAdmin, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="grid gap-1">
        <Label htmlFor="admin-email">Email of an existing user</Label>
        <Input id="admin-email" name="email" type="email" required />
      </div>
      <SubmitButton pendingLabel="Granting…">Make admin</SubmitButton>
      <div className="sm:col-span-2">
        <ActionResult state={state} />
      </div>
    </form>
  );
}

export function RevokeForm({ userId, self }: { userId: string; self: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(revokeAdmin.bind(null, userId), {});
  return (
    <form action={action} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmCheckbox label={self ? "Remove my own admin access" : "Remove admin access"} />
        <SubmitButton variant="outline" size="sm" pendingLabel="Removing…">
          Revoke
        </SubmitButton>
      </div>
      <ActionResult state={state} />
    </form>
  );
}
