import "server-only";

import { VIEW_AS_COOKIE } from "@/lib/admin/view-as-guard";
import { getCurrentUser } from "@/lib/auth/session";

import { checkLogger, resolveCheckAccess, transportFor } from "./access-server";
import { batchSchema, parseSingle, requestProblem, singleCheckSchema, singleInput } from "./http";
import { parseBatch, runChecks } from "./run";

// The Tools proxy (plan §6.2, Q2). The browser sends what to check; the
// server checks the session, membership, approval and subscription, adds
// the organisation's key, calls the API, logs the check without its bank
// details, and returns the API's answer. The key never leaves the server.

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function handleCheck(request: Request, mode: "single" | "bulk"): Promise<Response> {
  const problem = requestProblem(request);
  if (problem) return json({ error: problem.error }, problem.status);

  // ADM-13: no checks while an admin is viewing the portal as a customer.
  if (new RegExp(`(?:^|;\\s*)${VIEW_AS_COOKIE}=`).test(request.headers.get("cookie") ?? "")) {
    return json({ error: "You're viewing as a customer, so checks are turned off." }, 403);
  }

  const user = await getCurrentUser();
  // MFA, once turned on, must be completed for every request (SEC-01).
  if (!user || (user.hasMfa && user.aal !== "aal2")) {
    return json({ error: "Sign in to use the tools." }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send JSON" }, 400);
  }

  let lines;
  if (mode === "single") {
    const parsed = singleCheckSchema.safeParse(body);
    if (!parsed.success) return json({ error: "That isn't a check we recognise." }, 400);
    lines = [{ input: singleInput(parsed.data), parsed: parseSingle(parsed.data) }];
  } else {
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Send up to 25 lines at a time." }, 400);
    lines = parseBatch(parsed.data.lines, parsed.data.dataType);
  }

  const access = await resolveCheckAccess(user);
  if (access.mode === "denied") return json({ error: access.reason }, 403);

  try {
    const results = await runChecks(
      { transport: await transportFor(access), log: checkLogger(access, user.id, mode) },
      { pacingMs: mode === "bulk" ? access.pacingMs : 0 },
      lines,
    );
    return json({ mode: access.mode, results });
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "tools check failed",
        org: access.orgId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return json({ error: "We couldn't run the check. Please try again." }, 502);
  }
}
