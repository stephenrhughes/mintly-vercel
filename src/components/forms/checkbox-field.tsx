import type * as React from "react";

type CheckboxFieldProps = {
  name: string;
  children: React.ReactNode;
  error?: string;
  defaultChecked?: boolean;
  required?: boolean;
};

/** A native checkbox with its label and error. */
export function CheckboxField({
  name,
  children,
  error,
  defaultChecked,
  required,
}: CheckboxFieldProps) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-start gap-3">
        <input
          id={name}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
        />
        <label htmlFor={name} className="text-sm leading-snug">
          {children}
        </label>
      </div>
      {error ? (
        <p id={`${name}-error`} className="pl-7 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
