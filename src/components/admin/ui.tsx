import { CircleAlert, CircleCheck, ExternalLink } from "lucide-react";
import type * as React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Small pieces shared by the admin pages (plan §6.8).

/** What an admin Server Action returns to its form. */
export type ActionState = {
  error?: string;
  message?: string;
  warnings?: string[];
};

/** The outcome of an admin action: an error, or a message with any warnings. */
export function ActionResult({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (!state.message) return null;
  return (
    <Alert variant="success">
      <CircleCheck aria-hidden />
      <AlertDescription className="text-secondary-foreground">
        {state.message}
        {state.warnings?.length ? (
          <ul className="mt-1 list-disc pl-4">
            {state.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** A tick box that a destructive action requires. */
export function ConfirmCheckbox({ label, name = "confirm" }: { label: string; name?: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} className="size-4 accent-primary" />
      {label}
    </label>
  );
}

/** A table in the admin style. Children are the body rows. */
export function DataTable({
  head,
  children,
  className,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            {head.map((cell, i) => (
              <th key={i} className="py-2 pr-4 font-medium whitespace-nowrap last:pr-0">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("py-3 pr-4 align-top last:pr-0", className)}>{children}</td>;
}

export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="border-b last:border-0">{children}</tr>;
}

/** A definition list row: label on the left, value on the right. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words sm:col-span-2">{children}</dd>
    </div>
  );
}

/** A link that opens outside the app, such as the Stripe dashboard. */
export function ExternalAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

const statusTone: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  trialing: "secondary",
  past_due: "destructive",
  unpaid: "destructive",
  canceled: "outline",
  incomplete: "outline",
  incomplete_expired: "outline",
};

const statusWords: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  unpaid: "Unpaid",
  canceled: "Cancelled",
  incomplete: "Incomplete",
  incomplete_expired: "Incomplete, expired",
  paused: "Paused",
};

/** A Stripe subscription status. */
export function SubscriptionBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">None</span>;
  return <Badge variant={statusTone[status] ?? "outline"}>{statusWords[status] ?? status}</Badge>;
}

/** Monospace text for IDs. */
export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs break-all">{children}</code>
  );
}

export const textareaClass =
  "min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

export const selectClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";
