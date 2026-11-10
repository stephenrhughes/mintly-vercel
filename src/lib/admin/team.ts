// Team management by an admin (plan §6.8): the owner's own team operations
// (src/lib/team/operations.ts), run with the admin as the actor and
// recorded in admin_audit. Ownership transfer and the "invites from other
// domains" switch are admin-only.

import type { TeamResult } from "@/lib/team/operations";

import { type AuditSink, errorText } from "./audit";

/**
 * Runs a team operation and audits it when it succeeds. Refusals (a full
 * team, an address already invited) change nothing and aren't audited; an
 * unexpected failure is, as team.failed, then rethrown.
 */
export async function auditedTeamChange(
  audit: AuditSink,
  entry: { actorId: string; orgId: string; action: string; details: Record<string, unknown> },
  run: () => Promise<TeamResult>,
): Promise<TeamResult> {
  let result: TeamResult;
  try {
    result = await run();
  } catch (error) {
    await audit({
      actorId: entry.actorId,
      orgId: entry.orgId,
      action: "team.failed",
      details: { ...entry.details, change: entry.action, error: errorText(error) },
    });
    throw error;
  }
  if (result.ok && result.message !== "No change.") {
    await audit({
      actorId: entry.actorId,
      orgId: entry.orgId,
      action: entry.action,
      details: entry.details,
    });
  }
  return result;
}

/** The owner-facing wording, reworded for an admin acting on the team. */
export function forAdmin(result: TeamResult): TeamResult {
  if (result.ok) return result;
  if (result.error.startsWith("The owner can't be changed here")) {
    return { ...result, error: "Transfer ownership to someone else first." };
  }
  if (result.error.startsWith("Your team is full")) {
    return {
      ...result,
      error: `${result.error.replace("Your team", "The team").replace(/ Remove a member.*$/, "")} Add extra seats on the subscription, or withdraw an invite, first.`,
    };
  }
  return { ...result, error: result.error.replace("Your account", "This organisation") };
}
