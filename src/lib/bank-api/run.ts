// Running checks for the Tools page (plan §6.2): one by one, paced to the
// plan's throttle (TOOL-09), stopping at the first rate limit, and logging
// each check without its bank details (plan §4 check_log).

import { type BulkDataType, type CheckKind, parseBulkLine, type Parsed } from "./requests";
import { type BankTransport, type Outcome, NETWORK_ERROR_BODY, send } from "./transport";

/** What the browser gets back for each line. Never contains the key. */
export type CheckResult = {
  index: number;
  input: string;
  outcome: Outcome | "malformed" | "not_sent";
  kind?: CheckKind;
  /** The API path called, so the page can show the matching request (TOOL-07). */
  path?: string;
  status?: number;
  /** The API's response body, as it came (plan §6.2). */
  body?: unknown;
  message?: string;
};

export type LogEntry = { kind: CheckKind; outcome: Outcome };

export type RunDeps = {
  transport: BankTransport;
  /** Writes check_log rows. A failure is logged, never shown to the user. */
  log(entries: LogEntry[]): Promise<void>;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs parsed lines, in order. Malformed lines are reported and not sent (TOOL-08). */
export async function runChecks(
  deps: RunDeps,
  options: { pacingMs: number },
  lines: Array<{ input: string; parsed: Parsed }>,
): Promise<CheckResult[]> {
  const sleep = deps.sleep ?? defaultSleep;
  const results: CheckResult[] = [];
  const logged: LogEntry[] = [];
  let sent = 0;
  let limited = false;

  for (const [index, { input, parsed }] of lines.entries()) {
    if (!parsed.ok) {
      results.push({ index, input, outcome: "malformed", message: parsed.error });
      continue;
    }
    const { request } = parsed;
    if (limited) {
      // After a rate limit the rest would only be refused too (TOOL-12).
      results.push({ index, input, kind: request.kind, path: request.path, outcome: "not_sent" });
      continue;
    }
    if (sent > 0 && options.pacingMs > 0) await sleep(options.pacingMs);
    sent += 1;

    const check = await send(deps.transport, request);
    logged.push({ kind: request.kind, outcome: check.outcome });
    if (check.outcome === "rate_limited") limited = true;
    results.push({
      index,
      input,
      kind: request.kind,
      path: request.path,
      outcome: check.outcome,
      status: check.response?.status,
      body: check.response?.body ?? NETWORK_ERROR_BODY,
    });
  }

  if (logged.length > 0) {
    try {
      await deps.log(logged);
    } catch (error) {
      console.error("writing the check log failed", error);
    }
  }
  return results;
}

export function parseBatch(lines: string[], dataType: BulkDataType) {
  return lines.map((input) => ({ input, parsed: parseBulkLine(input, dataType) }));
}
