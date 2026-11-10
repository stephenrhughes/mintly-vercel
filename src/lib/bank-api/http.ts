import { z } from "zod";

import { BATCH_SIZE, BULK_DATA_TYPES, bicRequest, ibanRequest, sortCodeRequest } from "./requests";

// Request checks shared by POST /api/check and /api/check/batch (plan §6.2).

/**
 * Cross-site request protection: the browser must send JSON from the same
 * origin. A form on another site can't send application/json without a
 * CORS preflight, and the Origin header can't be forged by a page.
 */
export function requestProblem(request: Request): { status: number; error: string } | null {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return { status: 415, error: "Send JSON" };
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return { status: 403, error: "Forbidden" };
  try {
    if (new URL(origin).host !== host) return { status: 403, error: "Forbidden" };
  } catch {
    return { status: 403, error: "Forbidden" };
  }
  return null;
}

const field = z.string().max(64);

export const singleCheckSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("account"), sortCode: field, accountNumber: field.optional() }),
  z.object({ kind: z.literal("iban"), iban: field }),
  z.object({ kind: z.literal("swift"), bic: field }),
]);

export type SingleCheck = z.infer<typeof singleCheckSchema>;

export function parseSingle(check: SingleCheck) {
  switch (check.kind) {
    case "account":
      return sortCodeRequest(check.sortCode, check.accountNumber ?? "");
    case "iban":
      return ibanRequest(check.iban);
    case "swift":
      return bicRequest(check.bic);
  }
}

export function singleInput(check: SingleCheck): string {
  switch (check.kind) {
    case "account":
      return [check.sortCode, check.accountNumber].filter(Boolean).join(",");
    case "iban":
      return check.iban;
    case "swift":
      return check.bic;
  }
}

export const batchSchema = z.object({
  dataType: z.enum(BULK_DATA_TYPES),
  lines: z.array(z.string().max(200)).min(1).max(BATCH_SIZE),
});
