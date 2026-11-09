"use client";

import { Loader2 } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isValidAccountNumber,
  isValidBic,
  isValidIban,
  isValidSortCode,
} from "@/lib/bank-api/requests";

import type { SingleBody } from "./check-api";

// Single checks (TOOL-03 to TOOL-05): sort code with an optional account
// number, IBAN, and SWIFT/BIC, each checked as you type.

type Field = {
  name: string;
  label: string;
  hint: string;
  placeholder: string;
  valid: (value: string) => boolean;
  required: boolean;
  inputMode?: "numeric";
  autoComplete?: string;
};

function CheckForm({
  title,
  fields,
  busy,
  disabled,
  onCheck,
}: {
  title: string;
  fields: Field[];
  busy: boolean;
  disabled: boolean;
  onCheck: (values: Record<string, string>) => void;
}) {
  const id = useId();
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const valueOf = (name: string) => values[name] ?? "";
  const fieldOk = (field: Field) =>
    field.required || valueOf(field.name) ? field.valid(valueOf(field.name)) : true;
  const complete = fields.every(
    (field) => fieldOk(field) && (!field.required || valueOf(field.name)),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(Object.fromEntries(fields.map((field) => [field.name, true])));
    if (complete) onCheck(values);
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4" noValidate>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {fields.map((field) => {
          const invalid = touched[field.name] && !fieldOk(field);
          return (
            <div key={field.name} className="grid flex-1 gap-1.5">
              <Label htmlFor={`${id}-${field.name}`}>{field.label}</Label>
              <Input
                id={`${id}-${field.name}`}
                name={field.name}
                placeholder={field.placeholder}
                inputMode={field.inputMode}
                autoComplete={field.autoComplete ?? "off"}
                spellCheck={false}
                value={valueOf(field.name)}
                aria-invalid={invalid || undefined}
                aria-describedby={`${id}-${field.name}-hint`}
                onChange={(event) => {
                  const value = event.target.value;
                  setValues((current) => ({ ...current, [field.name]: value }));
                  if (value) setTouched((current) => ({ ...current, [field.name]: true }));
                }}
                onBlur={() => setTouched((current) => ({ ...current, [field.name]: true }))}
              />
              <p
                id={`${id}-${field.name}-hint`}
                className={invalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
              >
                {field.hint}
              </p>
            </div>
          );
        })}
        <Button type="submit" className="sm:mt-6" disabled={busy || disabled || !complete}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {busy ? "Checking" : "Check"}
        </Button>
      </div>
    </form>
  );
}

export function SingleChecks({
  busy,
  disabled,
  onCheck,
}: {
  busy: boolean;
  disabled: boolean;
  onCheck: (body: SingleBody) => void;
}) {
  return (
    <div className="grid gap-4">
      <CheckForm
        title="Sort code and account number"
        busy={busy}
        disabled={disabled}
        fields={[
          {
            name: "sortCode",
            label: "Sort code",
            hint: "6 digits, with or without dashes.",
            placeholder: "12-34-56",
            valid: isValidSortCode,
            required: true,
            inputMode: "numeric",
          },
          {
            name: "accountNumber",
            label: "Account number (optional)",
            hint: "6 to 10 digits. Leave blank to check the sort code only.",
            placeholder: "12345678",
            valid: (value) => isValidAccountNumber(value),
            required: false,
            inputMode: "numeric",
          },
        ]}
        onCheck={(values) =>
          onCheck({
            kind: "account",
            sortCode: values.sortCode ?? "",
            accountNumber: values.accountNumber?.trim() || undefined,
          })
        }
      />
      <CheckForm
        title="IBAN"
        busy={busy}
        disabled={disabled}
        fields={[
          {
            name: "iban",
            label: "IBAN",
            hint: "Spaces are fine.",
            placeholder: "GB33 BUKB 2020 1555 5555 55",
            valid: isValidIban,
            required: true,
          },
        ]}
        onCheck={(values) => onCheck({ kind: "iban", iban: values.iban ?? "" })}
      />
      <CheckForm
        title="SWIFT/BIC"
        busy={busy}
        disabled={disabled}
        fields={[
          {
            name: "bic",
            label: "SWIFT/BIC",
            hint: "8 or 11 letters and numbers. 8-character codes are padded with XXX.",
            placeholder: "HLFXGB21",
            valid: isValidBic,
            required: true,
          },
        ]}
        onCheck={(values) => onCheck({ kind: "swift", bic: values.bic ?? "" })}
      />
    </div>
  );
}
