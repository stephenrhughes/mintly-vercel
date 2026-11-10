// Calling the Bank Account Checker API (API-02) and sorting each answer into
// an outcome for the Tools page and the check log (TOOL-10, TOOL-12). The
// key goes in the x-api-key header and nowhere else: a transport holds it in
// a closure, and nothing it returns contains it.

import type { CheckRequest } from "./requests";

export type Outcome = "valid" | "invalid" | "rate_limited" | "error";

export type ApiResponse = { status: number; body: unknown };

/** Sends one request; resolves with the API's status and body. */
export type BankTransport = (path: string) => Promise<ApiResponse>;

export const REQUEST_TIMEOUT_MS = 10_000;

export function createHttpTransport(input: {
  baseUrl: string;
  key: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): BankTransport {
  const doFetch = input.fetch ?? fetch;
  return async (path) => {
    const response = await doFetch(`${input.baseUrl}${path}`, {
      headers: { "x-api-key": input.key, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(input.timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { Message: text.slice(0, 200) };
    }
    return { status: response.status, body };
  };
}

/**
 * The outcome of an API answer. 404 and 400 mean the details aren't valid;
 * 429 is API Gateway's quota or throttle (TOOL-12); anything else, such as a
 * refused key, is an error on our side, not the customer's data.
 */
export function classify(response: ApiResponse): Outcome {
  if (response.status === 200) {
    const status = (response.body as { Status?: unknown } | null)?.Status;
    return status === "Invalid" ? "invalid" : "valid";
  }
  if (response.status === 404 || response.status === 400) return "invalid";
  if (response.status === 429) return "rate_limited";
  return "error";
}

/** The outcome for a request that never got an answer (timeout, network). */
export const NETWORK_ERROR_BODY = { Message: "We couldn't reach the checking service." };

export type SentCheck = { request: CheckRequest; outcome: Outcome; response: ApiResponse | null };

export async function send(transport: BankTransport, request: CheckRequest): Promise<SentCheck> {
  try {
    const response = await transport(request.path);
    return { request, outcome: classify(response), response };
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "bank api request failed",
        kind: request.kind,
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return { request, outcome: "error", response: null };
  }
}
