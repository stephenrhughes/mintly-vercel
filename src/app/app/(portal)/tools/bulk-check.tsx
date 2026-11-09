"use client";

import {
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Download,
  FileUp,
  Loader2,
  Square,
} from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  BATCH_SIZE,
  BULK_DATA_TYPES,
  type BulkDataType,
  bulkDataTypeLabels,
  MAX_BULK_FILE_BYTES,
  splitBulkInput,
} from "@/lib/bank-api/requests";
import { outcomeLabels, resultMessage, resultsToCsv } from "@/lib/bank-api/results";
import type { CheckResult } from "@/lib/bank-api/run";
import { cn } from "@/lib/utils";

import { AccountResult } from "./account-result";
import { checkBatch } from "./check-api";

// Bulk checks (TOOL-08 to TOOL-11): paste lines or drop a file, then the
// lines go to the server 25 at a time, one batch after another. The server
// paces the calls inside each batch to the plan's throttle (TOOL-09).

const placeholders: Record<BulkDataType, string> = {
  standard: "12-34-56,12345678\n65-43-21,87654321",
  sortcode: "12-34-56\n65-43-21",
  iban: "GB33BUKB20201555555555\nGB94BARC10201530093459",
  bic: "HLFXGB21\nBUKBGB22XXX",
};

function OutcomeIcon({ outcome }: { outcome: CheckResult["outcome"] }) {
  if (outcome === "valid") return <CircleCheck className="size-4 text-primary" aria-hidden />;
  if (outcome === "not_sent" || outcome === "malformed") {
    return <CircleSlash className="size-4 text-muted-foreground" aria-hidden />;
  }
  return <CircleAlert className="size-4 text-destructive" aria-hidden />;
}

function download(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "mintly-check-results.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BulkCheck({
  disabled,
  canDownload,
  onRateLimited,
  onStart,
  onFinish,
}: {
  disabled: boolean;
  canDownload: boolean;
  onRateLimited: () => void;
  onStart: () => void;
  /** Called when a run ends, however it ended. */
  onFinish: () => void;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [dataType, setDataType] = useState<BulkDataType>("standard");
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const stopRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const lineCount = splitBulkInput(text).length;

  const readFile = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!/\.(txt|csv)$/i.test(file.name)) {
      setFileError("Choose a .txt or .csv file.");
      return;
    }
    if (file.size > MAX_BULK_FILE_BYTES) {
      setFileError("That file is over 1 MB. Split it into smaller files.");
      return;
    }
    void file.text().then(setText);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    readFile(event.dataTransfer.files[0]);
  };

  const run = async () => {
    const lines = splitBulkInput(text);
    if (lines.length === 0) return;
    onStart();
    stopRef.current = false;
    setRunning(true);
    setError(null);
    setProgress(0);
    const collected: CheckResult[] = [];
    setResults([]);

    let stoppedAt: number | null = null;
    for (let start = 0; start < lines.length; start += BATCH_SIZE) {
      if (stopRef.current) {
        stoppedAt = start;
        break;
      }
      const chunk = lines.slice(start, start + BATCH_SIZE);
      const response = await checkBatch(dataType, chunk);
      if (!response.ok) {
        setError(response.error);
        stoppedAt = start;
        break;
      }
      collected.push(
        ...response.results.map((result) => ({ ...result, index: start + result.index })),
      );
      setResults([...collected]);
      setProgress(Math.round((100 * Math.min(start + BATCH_SIZE, lines.length)) / lines.length));
      if (response.results.some((result) => result.outcome === "rate_limited")) {
        onRateLimited();
        stoppedAt = start + chunk.length;
        break;
      }
    }

    if (stoppedAt !== null) {
      for (let index = stoppedAt; index < lines.length; index++) {
        collected.push({ index, input: lines[index], outcome: "not_sent" });
      }
      setResults([...collected]);
    }
    setRunning(false);
    onFinish();
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  const counts = results?.reduce<Record<string, number>>((acc, result) => {
    acc[result.outcome] = (acc[result.outcome] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 rounded-lg border bg-card p-4">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">What&apos;s on each line?</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {BULK_DATA_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="dataType"
                  value={type}
                  checked={dataType === type}
                  onChange={() => setDataType(type)}
                  className="size-4 accent-primary"
                />
                {bulkDataTypeLabels[type]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-lines`}>Lines to check</Label>
          <Textarea
            id={`${id}-lines`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={placeholders[dataType]}
            rows={8}
            spellCheck={false}
            className="max-h-80 font-mono text-sm"
            aria-describedby={`${id}-lines-hint`}
          />
          <p id={`${id}-lines-hint`} className="text-xs text-muted-foreground">
            One per line.
            {dataType === "standard"
              ? " Separate the sort code and account number with a comma."
              : ""}
            {lineCount > 0 ? ` ${lineCount.toLocaleString("en-GB")} lines.` : ""}
          </p>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground",
            dragging && "border-primary bg-secondary",
          )}
        >
          <FileUp className="size-5" aria-hidden />
          <p>
            Drop a file here, or{" "}
            <label className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline">
              choose a file
              <input
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="sr-only"
                onChange={(event) => {
                  readFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            . TXT or CSV, up to 1 MB.
          </p>
          {fileError ? (
            <p className="text-destructive" role="alert">
              {fileError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={run} disabled={disabled || running || lineCount === 0}>
            {running ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {running
              ? "Checking"
              : `Check ${lineCount > 0 ? lineCount.toLocaleString("en-GB") : ""} lines`}
          </Button>
          {running ? (
            <Button type="button" variant="outline" onClick={() => (stopRef.current = true)}>
              <Square aria-hidden />
              Stop
            </Button>
          ) : null}
        </div>
        {running ? <Progress value={progress} aria-label="Bulk check progress" /> : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {results && results.length > 0 ? (
        <section ref={resultsRef} aria-label="Bulk results" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm" aria-live="polite">
              <strong>{counts?.valid ?? 0}</strong> valid, <strong>{counts?.invalid ?? 0}</strong>{" "}
              invalid
              {results.length - (counts?.valid ?? 0) - (counts?.invalid ?? 0) > 0
                ? `, ${results.length - (counts?.valid ?? 0) - (counts?.invalid ?? 0)} not checked`
                : ""}
            </p>
            <div className="flex items-center gap-3">
              {!canDownload ? (
                <p className="text-xs text-muted-foreground">
                  Upgrade to a paid plan to download results.
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canDownload || running}
                onClick={() => download(resultsToCsv(results))}
              >
                <Download aria-hidden />
                Download CSV
              </Button>
            </div>
          </div>
          <ol className="divide-y rounded-lg border bg-card">
            {results.map((result) => (
              <li key={result.index}>
                {result.outcome === "valid" ? (
                  <details className="group">
                    <summary className="flex cursor-pointer items-start gap-3 px-4 py-2.5 text-sm">
                      <OutcomeIcon outcome={result.outcome} />
                      <ResultLine result={result} />
                    </summary>
                    <div className="border-t px-4 py-4">
                      <AccountResult body={result.body} valid />
                    </div>
                  </details>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    <OutcomeIcon outcome={result.outcome} />
                    <ResultLine result={result} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function ResultLine({ result }: { result: CheckResult }) {
  return (
    <span className="grid min-w-0 flex-1 gap-0.5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
      <span className="truncate font-mono">{result.input}</span>
      <span className="min-w-0 text-muted-foreground">
        <span className="font-medium text-foreground">{outcomeLabels[result.outcome]}</span>
        {resultMessage(result) ? ` · ${resultMessage(result)}` : ""}
      </span>
    </span>
  );
}
