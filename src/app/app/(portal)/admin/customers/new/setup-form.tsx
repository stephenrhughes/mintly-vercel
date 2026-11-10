"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { type PriceOption, PricePicker } from "@/components/admin/price-picker";
import { ActionResult, selectClass } from "@/components/admin/ui";
import { useKeepForm } from "@/components/admin/use-keep-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type SetupState, setUpCustomerAction } from "./actions";

// ADM-12: one form for any customer. The nonce stays the same until the
// set-up succeeds, so submitting again after a failure carries on where it
// stopped instead of making a second customer.
export function SetupForm({
  prices,
  organisationHref,
}: {
  prices: PriceOption[];
  organisationHref: string;
}) {
  const [state, action] = useActionState<SetupState, FormData>(setUpCustomerAction, {});
  const [nonce] = useState(() => crypto.randomUUID());
  const [billing, setBilling] = useState("invoice");
  const done = Boolean(state.message);
  const { onSubmit, pending } = useKeepForm(action);

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="nonce" value={nonce} />
      <div className="grid gap-1">
        <Label htmlFor="orgName">Organisation name</Label>
        <Input id="orgName" name="orgName" required disabled={done} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="ownerEmail">Owner&apos;s email (they&apos;re invited)</Label>
        <Input id="ownerEmail" name="ownerEmail" type="email" required disabled={done} />
      </div>

      <PricePicker prices={prices} idPrefix="setup" />

      <div className="grid gap-1">
        <Label htmlFor="billing">Billing</Label>
        <select
          id="billing"
          name="billing"
          value={billing}
          onChange={(e) => setBilling(e.target.value)}
          className={selectClass}
        >
          <option value="invoice">Invoice (send invoice)</option>
          <option value="card">Card (the owner adds one during the trial)</option>
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="trialDays">Trial (days, 0 for none)</Label>
        <Input
          id="trialDays"
          name="trialDays"
          type="number"
          min={0}
          max={730}
          defaultValue={billing === "card" ? 14 : 0}
          key={billing}
        />
      </div>
      {billing === "invoice" ? (
        <>
          <div className="grid gap-1">
            <Label htmlFor="daysUntilDue">Invoices due after (days)</Label>
            <Input
              id="daysUntilDue"
              name="daysUntilDue"
              type="number"
              min={1}
              max={90}
              defaultValue={30}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="mandateId">GoCardless mandate ID (optional)</Label>
            <Input id="mandateId" name="mandateId" placeholder="MD0001ABCD23EF" />
          </div>
        </>
      ) : null}
      <div className="grid gap-1">
        <Label htmlFor="extraUsers">Extra seats on top of the price&apos;s</Label>
        <Input
          id="extraUsers"
          name="extraUsers"
          type="number"
          min={0}
          max={1000}
          defaultValue={0}
        />
      </div>

      <div className="grid gap-3 sm:col-span-2">
        <ActionResult state={state} />
        {state.orgId ? (
          <Link
            href={`${organisationHref}/${state.orgId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Open the organisation
          </Link>
        ) : null}
        {done ? null : (
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Setting up…" : "Set up the customer"}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
