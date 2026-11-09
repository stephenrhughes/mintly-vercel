"use client";

import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { type RevealState, revealApiKey } from "./actions";

// SUB-03: the key is fetched only when asked for, never rendered into the page.
export function ApiKey() {
  const [state, setState] = useState<RevealState>({});
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = (then?: (value: string) => void) =>
    startTransition(async () => {
      const result = state.value ? state : await revealApiKey();
      setState(result);
      if (result.value) then?.(result.value);
    });

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-sm"
          aria-label="API key"
        >
          {visible && state.value ? state.value : "••••••••••••••••••••••••••••••••••••••••"}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => (visible ? setVisible(false) : load(() => setVisible(true)))}
        >
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : visible ? (
            <EyeOff aria-hidden />
          ) : (
            <Eye aria-hidden />
          )}
          {visible ? "Hide" : "Reveal"}
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={() => load(copy)}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
