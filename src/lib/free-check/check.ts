// The public free checker (FREE-01 to FREE-03, FREE-05; plan §6.9), as a pure
// function of the request and its dependencies so it can be tested without
// a database or the network. The route handler supplies the real ones.
//
// The answer is deliberately thin: VALID with the bank's name, or INVALID.
// Branch, address, BIC and payment types are for customers.

import { z } from "zod";

import type { CaptchaResult } from "@/lib/captcha";
import { sortCodeRequest } from "@/lib/bank-api/requests";
import type { BankTransport } from "@/lib/bank-api/transport";
import { FREE_CHECK_MIN_INTERVAL_SECONDS } from "@/lib/free-check/limits";

export const freeCheckSchema = z.object({
  sortCode: z.string().max(20),
  accountNumber: z.string().max(20).optional().default(""),
  token: z.string().max(4000).optional(),
});

export type TakeResult = { result: "ok" | "weekly_limit" | "too_fast"; used: number };

export type FreeCheckDeps = {
  verifyCaptcha: (token: string | undefined) => Promise<CaptchaResult>;
  /** Counts one check against the IP's weekly allowance (free_check_take). */
  take: () => Promise<TakeResult>;
  transport: () => Promise<BankTransport>;
};

export type FreeCheckResponse =
  | {
      status: 200;
      body:
        | { status: "VALID"; bank: string | null; used: number }
        | { status: "INVALID"; used: number };
    }
  | { status: 400; body: { error: "invalid_input"; message: string } }
  | { status: 401; body: { error: "captcha" } }
  | {
      status: 429;
      body: { error: "weekly_limit"; used: number } | { error: "too_fast"; retryAfter: number };
    }
  | { status: 503; body: { error: "unavailable" } };

export async function runFreeCheck(
  input: unknown,
  deps: FreeCheckDeps,
): Promise<FreeCheckResponse> {
  const parsed = freeCheckSchema.safeParse(input);
  if (!parsed.success)
    return { status: 400, body: { error: "invalid_input", message: "Enter a sort code." } };

  const request = sortCodeRequest(parsed.data.sortCode, parsed.data.accountNumber);
  if (!request.ok) return { status: 400, body: { error: "invalid_input", message: request.error } };

  const captcha = await deps.verifyCaptcha(parsed.data.token);
  if (!captcha.ok) {
    return captcha.reason === "unavailable" || captcha.reason === "not_configured"
      ? { status: 503, body: { error: "unavailable" } }
      : { status: 401, body: { error: "captcha" } };
  }

  let taken: TakeResult;
  try {
    taken = await deps.take();
  } catch {
    return { status: 503, body: { error: "unavailable" } };
  }
  if (taken.result === "weekly_limit")
    return { status: 429, body: { error: "weekly_limit", used: taken.used } };
  // Too soon after the last check: not counted, and not a lockout.
  if (taken.result === "too_fast") {
    return {
      status: 429,
      body: { error: "too_fast", retryAfter: FREE_CHECK_MIN_INTERVAL_SECONDS },
    };
  }

  try {
    const transport = await deps.transport();
    const response = await transport(request.request.path);
    const body = response.body as {
      Status?: string;
      BranchData?: { Info?: { ShortOwningBank?: string } };
    } | null;
    if (response.status === 200 && body?.Status !== "Invalid") {
      return {
        status: 200,
        body: {
          status: "VALID",
          bank: body?.BranchData?.Info?.ShortOwningBank ?? null,
          used: taken.used,
        },
      };
    }
    if (response.status === 404 || response.status === 400 || response.status === 200) {
      return { status: 200, body: { status: "INVALID", used: taken.used } };
    }
    return { status: 503, body: { error: "unavailable" } };
  } catch {
    return { status: 503, body: { error: "unavailable" } };
  }
}
