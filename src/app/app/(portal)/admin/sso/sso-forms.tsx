"use client";

import { useActionState } from "react";

import {
  ActionResult,
  type ActionState,
  ConfirmCheckbox,
  selectClass,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { removeSsoAction, saveSsoAction } from "./actions";

type Org = { id: string; name: string };

export type SsoValues = {
  domain: string;
  orgId: string;
  providerId: string;
  defaultRole: "developer" | "member";
  enabled: boolean;
};

export function SsoForm({ orgs, values }: { orgs: Org[]; values?: SsoValues }) {
  const isNew = !values;
  const [state, action] = useActionState<ActionState, FormData>(
    saveSsoAction.bind(null, isNew),
    {},
  );
  const id = (name: string) => `${values?.domain ?? "new"}-${name}`;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1">
        <Label htmlFor={id("domain")}>Email domain</Label>
        {isNew ? (
          <Input id={id("domain")} name="domain" placeholder="acme.co.uk" required />
        ) : (
          <>
            <Input id={id("domain")} value={values.domain} disabled />
            <input type="hidden" name="domain" value={values.domain} />
          </>
        )}
      </div>
      <div className="grid gap-1">
        <Label htmlFor={id("org")}>Organisation</Label>
        <select
          id={id("org")}
          name="orgId"
          defaultValue={values?.orgId ?? ""}
          className={selectClass}
          required
        >
          <option value="" disabled>
            Choose…
          </option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={id("provider")}>Supabase SSO provider ID</Label>
        <Input
          id={id("provider")}
          name="providerId"
          defaultValue={values?.providerId}
          placeholder="From supabase sso add"
          required
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={id("role")}>New users join as</Label>
        <select
          id={id("role")}
          name="defaultRole"
          defaultValue={values?.defaultRole ?? "member"}
          className={selectClass}
        >
          <option value="member">Member</option>
          <option value="developer">Developer</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={values?.enabled ?? true}
          className="size-4 accent-primary"
        />
        Sign in with SSO is on for this domain
      </label>
      <div className="sm:col-span-2">
        <ActionResult state={state} />
      </div>
      <div>
        <SubmitButton size="sm" variant={isNew ? "default" : "outline"} pendingLabel="Saving…">
          {isNew ? "Add domain" : "Save"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function RemoveSsoForm({ domain }: { domain: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    removeSsoAction.bind(null, domain),
    {},
  );
  return (
    <form action={action} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmCheckbox label={`Remove ${domain}`} />
        <SubmitButton variant="destructive" size="sm" pendingLabel="Removing…">
          Remove
        </SubmitButton>
      </div>
      <ActionResult state={state} />
    </form>
  );
}
