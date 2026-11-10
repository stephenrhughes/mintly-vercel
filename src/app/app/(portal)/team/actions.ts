"use server";

import { refresh } from "next/cache";

import type { FormState } from "@/lib/auth/errors";
import { type AppUser, requireUser } from "@/lib/auth/session";
import {
  type Actor,
  changeRole,
  inviteMember,
  type OrgContext,
  personName,
  removeMember,
  resendInvite,
  revokeInvite,
  type TeamResult,
} from "@/lib/team/operations";
import { canManageTeam, notOwnerMessage } from "@/lib/team/rules";
import { teamDeps } from "@/lib/team/server";

// Team changes (plan §6.6). Every action re-checks on the server that the
// signed-in user is the organisation's owner (TEAM-04, TEAM-08, TEAM-09).

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function ownerContext(user: AppUser): { actor: Actor; org: OrgContext } | null {
  const membership = user.membership;
  if (!membership || !canManageTeam(membership.role)) return null;
  return {
    actor: {
      id: user.id,
      email: user.email,
      name: personName(user.firstName, user.lastName) ?? user.email,
    },
    org: {
      orgId: membership.orgId,
      orgName: membership.orgName,
      reviewStatus: membership.reviewStatus,
    },
  };
}

function toState(result: TeamResult, values?: Record<string, string>): FormState {
  if (!result.ok) {
    return result.field
      ? { fieldErrors: { [result.field]: result.error }, values }
      : { error: result.error, values };
  }
  refresh();
  return { message: result.warning ? `${result.message} ${result.warning}` : result.message };
}

async function run(
  formData: FormData,
  operation: (ctx: { actor: Actor; org: OrgContext }) => Promise<TeamResult>,
  values?: Record<string, string>,
): Promise<FormState> {
  const user = await requireUser("/team");
  const ctx = ownerContext(user);
  if (!ctx) return { error: notOwnerMessage };
  try {
    return toState(await operation(ctx), values);
  } catch (error) {
    console.error("team change failed", error);
    return { error: "Something went wrong. Please try again.", values };
  }
}

export async function invite(_state: FormState, formData: FormData): Promise<FormState> {
  const values = { email: text(formData, "email").toLowerCase(), role: text(formData, "role") };
  return run(
    formData,
    (ctx) => inviteMember(teamDeps(), { ...ctx, email: values.email, role: values.role }),
    values,
  );
}

export async function resend(_state: FormState, formData: FormData): Promise<FormState> {
  return run(formData, (ctx) =>
    resendInvite(teamDeps(), { ...ctx, inviteId: text(formData, "inviteId") }),
  );
}

export async function revoke(_state: FormState, formData: FormData): Promise<FormState> {
  return run(formData, (ctx) =>
    revokeInvite(teamDeps(), { org: ctx.org, inviteId: text(formData, "inviteId") }),
  );
}

export async function remove(_state: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  return run(formData, (ctx) =>
    removeMember(teamDeps(), { ...ctx, userId: text(formData, "userId") }),
  );
}

export async function setRole(_state: FormState, formData: FormData): Promise<FormState> {
  return run(formData, (ctx) =>
    changeRole(teamDeps(), {
      ...ctx,
      userId: text(formData, "userId"),
      role: text(formData, "role"),
    }),
  );
}
