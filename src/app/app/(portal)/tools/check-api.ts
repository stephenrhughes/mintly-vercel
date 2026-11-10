import type { BulkDataType } from "@/lib/bank-api/requests";
import type { CheckResult } from "@/lib/bank-api/run";

// The browser's side of the Tools proxy (plan §6.2). It sends only what to
// check; the server adds the key.

export type SingleBody =
  | { kind: "account"; sortCode: string; accountNumber?: string }
  | { kind: "iban"; iban: string }
  | { kind: "swift"; bic: string };

export type CheckResponse =
  | { ok: true; mode: "production" | "sandbox"; results: CheckResult[] }
  | { ok: false; error: string };

async function post(url: string, body: unknown): Promise<CheckResponse> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      mode?: "production" | "sandbox";
      results?: CheckResult[];
    };
    if (!response.ok || !data.results || !data.mode) {
      return {
        ok: false,
        error:
          response.status === 401
            ? "Your session has ended. Sign in again to keep checking."
            : (data.error ?? "We couldn't run the check. Please try again."),
      };
    }
    return { ok: true, mode: data.mode, results: data.results };
  } catch {
    return { ok: false, error: "We couldn't reach Mintly. Check your connection and try again." };
  }
}

export const checkOne = (body: SingleBody) => post("/api/check", body);

export const checkBatch = (dataType: BulkDataType, lines: string[]) =>
  post("/api/check/batch", { dataType, lines });
