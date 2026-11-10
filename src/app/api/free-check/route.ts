import { NextResponse } from "next/server";

import { requestProblem } from "@/lib/bank-api/http";
import { runFreeCheck } from "@/lib/free-check/check";
import { freeCheckDeps } from "@/lib/free-check/server";

// POST /api/free-check: the public sort code checker (plan §6.9, FREE-01 to
// FREE-05). Same-origin JSON only, reCAPTCHA v3, 10 checks per IP per week
// at least 2 seconds apart, and the bank name only in the answer.
export async function POST(request: Request) {
  const problem = requestProblem(request);
  if (problem) return NextResponse.json({ error: problem.error }, { status: problem.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input", message: "Send JSON" }, { status: 400 });
  }

  const result = await runFreeCheck(body, freeCheckDeps(request));
  const headers: HeadersInit = { "Cache-Control": "no-store" };
  if (result.status === 429 && result.body.error === "too_fast") {
    (headers as Record<string, string>)["Retry-After"] = String(result.body.retryAfter);
  }
  return NextResponse.json(result.body, { status: result.status, headers });
}
