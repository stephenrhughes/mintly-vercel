"use client";

import { useState } from "react";

import { selectClass } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Choosing a price on an admin form (ADM-11, ADM-12): any existing price,
// or a new custom one based on an existing price's product and metadata.

export type PriceOption = { id: string; label: string; product: "bank_checker" | "eiscd" };

const productNames = { bank_checker: "Bank Account Checker", eiscd: "EISCD" } as const;

function Options({ prices }: { prices: PriceOption[] }) {
  return (
    <>
      {(["bank_checker", "eiscd"] as const).map((product) => {
        const group = prices.filter((p) => p.product === product);
        return group.length ? (
          <optgroup key={product} label={productNames[product]}>
            {group.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </>
  );
}

export function PricePicker({ prices, idPrefix }: { prices: PriceOption[]; idPrefix: string }) {
  const [kind, setKind] = useState<"existing" | "custom">("existing");
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <fieldset className="grid gap-3 sm:col-span-2">
      <legend className="mb-1 text-sm font-medium">Price</legend>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="priceKind"
            value="existing"
            checked={kind === "existing"}
            onChange={() => setKind("existing")}
            className="accent-primary"
          />
          An existing price
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="priceKind"
            value="custom"
            checked={kind === "custom"}
            onChange={() => setKind("custom")}
            className="accent-primary"
          />
          A new custom price
        </label>
      </div>
      {kind === "existing" ? (
        <select name="priceId" aria-label="Price" className={selectClass} required defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          <Options prices={prices} />
        </select>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor={id("base")}>Based on (product, usage plans and seats are copied)</Label>
            <select
              id={id("base")}
              name="basePriceId"
              className={selectClass}
              required
              defaultValue=""
            >
              <option value="" disabled>
                Choose…
              </option>
              <Options prices={prices} />
            </select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor={id("amount")}>Amount (£, before VAT)</Label>
            <Input
              id={id("amount")}
              name="customAmount"
              inputMode="decimal"
              placeholder="1200"
              required
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={id("interval")}>Billed</Label>
            <select
              id={id("interval")}
              name="customInterval"
              defaultValue="year"
              className={selectClass}
            >
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor={id("name")}>Name shown to the customer</Label>
            <Input id={id("name")} name="customName" placeholder="Acme annual licence" required />
          </div>
        </div>
      )}
    </fieldset>
  );
}
