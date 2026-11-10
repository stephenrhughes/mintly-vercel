"use client";

import { useActionState, useState } from "react";

import { type PriceOption, PricePicker } from "@/components/admin/price-picker";
import {
  ActionResult,
  type ActionState,
  ConfirmCheckbox,
  selectClass,
  textareaClass,
} from "@/components/admin/ui";
import { useKeepForm } from "@/components/admin/use-keep-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createOfferAction, revokeOfferAction } from "./actions";

export function OfferForm({
  prices,
  orgs,
  defaultExpiry,
}: {
  prices: PriceOption[];
  orgs: Array<{ id: string; name: string }>;
  defaultExpiry: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(createOfferAction, {});
  const [nonce] = useState(() => crypto.randomUUID());
  const [target, setTarget] = useState("org");
  const { onSubmit, pending } = useKeepForm(action);
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="nonce" value={nonce} />
      <div className="grid gap-1">
        <Label htmlFor="target">For</Label>
        <select
          id="target"
          name="target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={selectClass}
        >
          <option value="org">An organisation</option>
          <option value="email">An email address (no organisation yet)</option>
        </select>
      </div>
      {target === "org" ? (
        <div className="grid gap-1">
          <Label htmlFor="orgId">Organisation</Label>
          <select id="orgId" name="orgId" className={selectClass} required defaultValue="">
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
      ) : (
        <div className="grid gap-1">
          <Label htmlFor="offer-email">Email</Label>
          <Input id="offer-email" name="email" type="email" required />
        </div>
      )}
      <PricePicker prices={prices} idPrefix="offer" />
      <div className="grid gap-1 sm:col-span-2">
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          name="headline"
          placeholder="Professional at Standard Plus price for a year"
          required
        />
      </div>
      <div className="grid gap-1 sm:col-span-2">
        <Label htmlFor="message">Message (optional)</Label>
        <textarea id="message" name="message" className={textareaClass} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="expiresAt">Expires</Label>
        <Input id="expiresAt" name="expiresAt" type="date" defaultValue={defaultExpiry} required />
      </div>
      <div className="grid gap-3 sm:col-span-2">
        <ActionResult state={state} />
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Make the offer"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function RevokeOfferForm({ offerId }: { offerId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    revokeOfferAction.bind(null, offerId),
    {},
  );
  return (
    <form action={action} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ConfirmCheckbox label="Withdraw" />
        <SubmitButton variant="outline" size="sm" pendingLabel="Withdrawing…">
          Withdraw
        </SubmitButton>
      </div>
      <ActionResult state={state} />
    </form>
  );
}
