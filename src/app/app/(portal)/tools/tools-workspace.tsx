"use client";

import { ArrowUpRight, CircleAlert, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CheckResult } from "@/lib/bank-api/run";

import { AccountResult } from "./account-result";
import { notifyOwner } from "./actions";
import { BulkCheck } from "./bulk-check";
import { checkOne, type SingleBody } from "./check-api";
import { CodeBlock, KEY_PLACEHOLDER, sampleCode } from "./code-samples";
import { SingleChecks } from "./single-check";

export type ToolsWorkspaceProps = {
  /** Production checks, or the sandbox while the organisation awaits review. */
  mode: "production" | "sandbox";
  canDownload: boolean;
  isOwner: boolean;
  trialing: boolean;
  /** The API base shown in the code samples. */
  apiBaseUrl: string;
  changePlanHref: string;
  /** Where owners and developers copy the key; null for members. */
  keyHref: string | null;
};

export function ToolsWorkspace(props: ToolsWorkspaceProps) {
  const [single, setSingle] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [busy, startTransition] = useTransition();
  const resultRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const check = (body: SingleBody) =>
    startTransition(async () => {
      setError(null);
      setRateLimited(false);
      const response = await checkOne(body);
      if (!response.ok) {
        setSingle(null);
        setError(response.error);
        return;
      }
      // The "checks in the last 30 days" count is rendered on the server.
      router.refresh();
      const [result] = response.results;
      if (result.outcome === "rate_limited") {
        setSingle(null);
        setRateLimited(true);
        return;
      }
      setSingle(result);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }));
    });

  return (
    <div className="grid gap-6">
      <Tabs defaultValue="single">
        <TabsList aria-label="Kind of check">
          <TabsTrigger value="single">Single check</TabsTrigger>
          <TabsTrigger value="bulk">Bulk check</TabsTrigger>
        </TabsList>
        <TabsContent value="single" className="grid gap-6">
          <SingleChecks busy={busy} disabled={false} onCheck={check} />
          {error ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {rateLimited ? <RateLimitNotice {...props} /> : null}
          {single ? (
            <div ref={resultRef}>
              <SingleResult result={single} apiBaseUrl={props.apiBaseUrl} keyHref={props.keyHref} />
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="bulk" className="grid gap-6">
          {rateLimited ? <RateLimitNotice {...props} /> : null}
          <BulkCheck
            disabled={false}
            canDownload={props.canDownload}
            onStart={() => setRateLimited(false)}
            onRateLimited={() => setRateLimited(true)}
            onFinish={() => router.refresh()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// TOOL-12 and plan §6.12 prompts: say why the checks stopped and what to do.
function RateLimitNotice({ mode, isOwner, trialing, changePlanHref }: ToolsWorkspaceProps) {
  const [notified, setNotified] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Alert role="alert">
      <CircleAlert aria-hidden />
      <AlertTitle>Request limit reached</AlertTitle>
      <AlertDescription>
        <p>
          {mode === "sandbox"
            ? "The sandbox limits how many checks can be made. Please wait a moment and try again."
            : trialing
              ? "Your trial's daily limit has been reached. Checks start again tomorrow, or straight away on a paid plan."
              : "Your plan's request limit has been reached. Wait a moment and try again, or move to a plan with more checks."}
        </p>
        {mode === "production" ? (
          isOwner ? (
            <Button asChild size="sm" className="mt-2">
              <a href={changePlanHref}>
                Upgrade your plan
                <ArrowUpRight aria-hidden />
              </a>
            </Button>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span>Ask your account owner to upgrade.</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || notified === "sent"}
                onClick={() =>
                  startTransition(async () => {
                    const result = await notifyOwner();
                    setNotified(result.sent ? "sent" : (result.error ?? "error"));
                  })
                }
              >
                <Mail aria-hidden />
                {notified === "sent" ? "Owner notified" : "Notify my owner"}
              </Button>
              {notified && notified !== "sent" ? (
                <span className="text-destructive">{notified}</span>
              ) : null}
            </div>
          )
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

// One result with how to make the same call (TOOL-06, TOOL-07, TOOL-13).
function SingleResult({
  result,
  apiBaseUrl,
  keyHref,
}: {
  result: CheckResult;
  apiBaseUrl: string;
  keyHref: string | null;
}) {
  const samples = result.path ? sampleCode(apiBaseUrl, result.path) : [];
  return (
    <section aria-label="Result" className="grid gap-4 rounded-lg border bg-card p-4">
      <Tabs defaultValue="result">
        <TabsList aria-label="Result details">
          <TabsTrigger value="result">Result</TabsTrigger>
          <TabsTrigger value="request" disabled={!result.path}>
            API request
          </TabsTrigger>
          <TabsTrigger value="response">API response</TabsTrigger>
        </TabsList>
        <TabsContent value="result">
          {result.outcome === "error" ? (
            <p className="text-sm text-destructive">
              Something went wrong with this check. Please try again.
            </p>
          ) : (
            <AccountResult body={result.body} valid={result.outcome === "valid"} />
          )}
        </TabsContent>
        <TabsContent value="request" className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            The same check with the API: <code className="font-mono">GET {result.path}</code>.
            Replace <code className="font-mono">{KEY_PLACEHOLDER}</code> with your
            organisation&apos;s key
            {keyHref ? (
              <>
                , which you can copy from the{" "}
                <a
                  href={keyHref}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  subscription page
                </a>
              </>
            ) : (
              ", which your account owner or a developer can give you"
            )}
            .
          </p>
          {samples.map((sample) => (
            <div key={sample.id} className="grid gap-1.5">
              <h3 className="text-sm font-semibold">{sample.label}</h3>
              <CodeBlock code={sample.code} label={`${sample.label} example`} />
            </div>
          ))}
        </TabsContent>
        <TabsContent value="response">
          <CodeBlock
            code={JSON.stringify(result.body ?? null, null, 2)}
            label="API response body"
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
