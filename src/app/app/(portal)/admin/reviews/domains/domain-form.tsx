"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type ActionState, addListedDomain } from "../actions";

export function DomainForm({ list }: { list: "trusted" | "blocked" }) {
  const [state, action] = useActionState<ActionState, FormData>(addListedDomain, {});
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="list" value={list} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${list}-domain`}>Domain</Label>
          <Input id={`${list}-domain`} name="domain" placeholder="acme.co.uk" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${list}-reason`}>Reason (optional)</Label>
          <Input id={`${list}-reason`} name="reason" />
        </div>
      </div>
      <div>
        <SubmitButton
          variant={list === "blocked" ? "destructive" : "default"}
          pendingLabel="Adding…"
        >
          {list === "trusted" ? "Trust domain" : "Block domain"}
        </SubmitButton>
      </div>
    </form>
  );
}
