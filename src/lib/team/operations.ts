import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { OrgRole, ReviewStatus } from "@/lib/nav";

import {
  INVITE_EXPIRY_DAYS,
  inviteDomainProblem,
  inviteErrorMessage,
  isInvitableRole,
  type InvitableRole,
  memberChangeProblem,
  teamErrorHint,
  type TeamErrorHint,
} from "./rules";
import { hashInviteToken, isPlausibleToken, newInviteToken } from "./tokens";

// Team changes (plan §6.6; TEAM-04 to TEAM-09, JOIN-*). Callers have
// checked the session and that the actor is the organisation's owner
// (canManageTeam); every write here is also scoped to that organisation.
// Seat checks and joins happen in the database under a per-organisation
// lock (create_invitation, accept_invitation).

export type InviteEmail = {
  orgName: string;
  inviterName: string;
  role: InvitableRole;
  token: string;
  expiresAt: Date;
};

export type TeamDeps = {
  /** Supabase with the service role. */
  db: SupabaseClient;
  sendInvite(to: string, invite: InviteEmail): Promise<void>;
  now?: () => Date;
};

export type Actor = { id: string; email: string; name: string };

export type OrgContext = { orgId: string; orgName: string; reviewStatus: ReviewStatus };

export type TeamResult =
  | { ok: true; message: string; warning?: string }
  | { ok: false; error: string; field?: "email" | "role" };

const emailSchema = z.email().max(254);

const expiry = (now: Date) => new Date(now.getTime() + INVITE_EXPIRY_DAYS * 86_400_000);

/** TEAM-04, TEAM-05, TEAM-07: invite someone, or hold the invite until approval. */
export async function inviteMember(
  deps: TeamDeps,
  input: {
    actor: Actor;
    org: OrgContext;
    email: string;
    role: string;
    /**
     * The owner's email, whose domain invitees must share. Defaults to the
     * actor's, who is the owner; an admin inviting for an organisation
     * passes the owner's (plan §6.8).
     */
    ownerEmail?: string | null;
  },
): Promise<TeamResult> {
  const email = input.email.trim().toLowerCase();
  if (!emailSchema.safeParse(email).success) {
    return { ok: false, error: "Enter a valid email address", field: "email" };
  }
  if (!isInvitableRole(input.role)) {
    return { ok: false, error: "Choose Developer or Member", field: "role" };
  }
  const { reviewStatus } = input.org;
  if (reviewStatus === "rejected" || reviewStatus === "suspended") {
    return { ok: false, error: "Your account can't invite people at the moment." };
  }

  const org = await deps.db
    .from("organisations")
    .select("allow_external_invites")
    .eq("id", input.org.orgId)
    .single<{ allow_external_invites: boolean }>();
  if (org.error) throw new Error(`reading the organisation failed: ${org.error.message}`);

  const domainProblem = inviteDomainProblem({
    ownerEmail: input.ownerEmail === undefined ? input.actor.email : (input.ownerEmail ?? ""),
    inviteeEmail: email,
    allowExternal: org.data.allow_external_invites,
  });
  if (domainProblem) return { ok: false, error: domainProblem, field: "email" };

  // Plan §6.11: a pending organisation's invites are held and sent on approval.
  const send = reviewStatus === "approved";
  const token = newInviteToken();
  const { error } = await deps.db.rpc("create_invitation", {
    p_org: input.org.orgId,
    p_email: email,
    p_role: input.role,
    p_token_hash: hashInviteToken(token),
    p_invited_by: input.actor.id,
    p_send: send,
  });
  if (error) {
    const message = inviteErrorMessage(teamErrorHint(error), error.details);
    if (message) return { ok: false, error: message };
    throw new Error(`creating the invite failed: ${error.message}`);
  }

  if (!send) {
    return {
      ok: true,
      message: `We'll send ${email} their invite as soon as your account is approved.`,
    };
  }
  return sendOrWarn(deps, email, {
    orgName: input.org.orgName,
    inviterName: input.actor.name,
    role: input.role,
    token,
    expiresAt: expiry(deps.now?.() ?? new Date()),
  });
}

async function sendOrWarn(deps: TeamDeps, email: string, invite: InviteEmail): Promise<TeamResult> {
  try {
    await deps.sendInvite(email, invite);
    return { ok: true, message: `Invite sent to ${email}.` };
  } catch (error) {
    console.error("sending the invite failed", error);
    return {
      ok: true,
      message: `The invite to ${email} is saved.`,
      warning: "We couldn't send the email. Use Resend to try again.",
    };
  }
}

type InviteRow = {
  id: string;
  email: string;
  role: InvitableRole;
  sent_at: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
};

async function loadOpenInvite(db: SupabaseClient, orgId: string, inviteId: string) {
  const { data, error } = await db
    .from("invitations")
    .select("id, email, role, sent_at, expires_at, accepted_at, revoked_at")
    .eq("id", inviteId)
    .eq("org_id", orgId)
    .maybeSingle<InviteRow>();
  if (error) throw new Error(`reading the invite failed: ${error.message}`);
  return data && !data.accepted_at && !data.revoked_at ? data : null;
}

/** Sends an invite again with a new link and a fresh 14 days. */
export async function resendInvite(
  deps: TeamDeps,
  input: { actor: Actor; org: OrgContext; inviteId: string; ownerEmail?: string | null },
): Promise<TeamResult> {
  const invite = await loadOpenInvite(deps.db, input.org.orgId, input.inviteId);
  if (!invite) return { ok: false, error: "That invite is no longer open." };
  if (input.org.reviewStatus !== "approved" || !invite.sent_at) {
    return { ok: false, error: "This invite is sent automatically once your account is approved." };
  }

  const now = deps.now?.() ?? new Date();
  // An expired invite no longer holds a seat, so it goes through the seat
  // check again as a new invite.
  if (invite.expires_at && new Date(invite.expires_at) <= now) {
    return inviteMember(deps, {
      actor: input.actor,
      org: input.org,
      email: invite.email,
      role: invite.role,
      ownerEmail: input.ownerEmail,
    });
  }

  const token = newInviteToken();
  const expiresAt = expiry(now);
  const { data, error } = await deps.db
    .from("invitations")
    .update({
      token_hash: hashInviteToken(token),
      sent_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", invite.id)
    .eq("org_id", input.org.orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(`refreshing the invite failed: ${error.message}`);
  if (!data?.length) return { ok: false, error: "That invite is no longer open." };

  return sendOrWarn(deps, invite.email, {
    orgName: input.org.orgName,
    inviterName: input.actor.name,
    role: invite.role,
    token,
    expiresAt,
  });
}

/** TEAM-08: withdraw an invite. Its link stops working and its seat is freed. */
export async function revokeInvite(
  deps: TeamDeps,
  input: { org: OrgContext; inviteId: string },
): Promise<TeamResult> {
  const { data, error } = await deps.db
    .from("invitations")
    .update({ revoked_at: (deps.now?.() ?? new Date()).toISOString() })
    .eq("id", input.inviteId)
    .eq("org_id", input.org.orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("email");
  if (error) throw new Error(`withdrawing the invite failed: ${error.message}`);
  const email = (data as { email: string }[] | null)?.[0]?.email;
  if (!email) return { ok: false, error: "That invite is no longer open." };
  return { ok: true, message: `The invite to ${email} has been withdrawn.` };
}

async function loadMember(db: SupabaseClient, orgId: string, userId: string) {
  const { data, error } = await db
    .from("memberships")
    .select("user_id, role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle<{ user_id: string; role: OrgRole }>();
  if (error) throw new Error(`reading the member failed: ${error.message}`);
  return data ? { userId: data.user_id, role: data.role } : null;
}

/**
 * TEAM-08: remove someone from the team. They keep their login but lose
 * access to the organisation's tools, usage and key.
 */
export async function removeMember(
  deps: TeamDeps,
  input: { actor: Actor; org: OrgContext; userId: string },
): Promise<TeamResult> {
  const target = await loadMember(deps.db, input.org.orgId, input.userId);
  const problem = memberChangeProblem({ actorId: input.actor.id, target, change: "remove" });
  if (problem) return { ok: false, error: problem };

  const { data, error } = await deps.db
    .from("memberships")
    .delete()
    .eq("org_id", input.org.orgId)
    .eq("user_id", input.userId)
    .neq("role", "owner")
    .select("user_id");
  if (error) throw new Error(`removing the member failed: ${error.message}`);
  if (!data?.length) return { ok: false, error: "That person isn't in your team." };

  return {
    ok: true,
    message: "They've been removed from the team.",
    // A developer could see the key (plan §3), so suggest rotating it (KEY-01).
    ...(target?.role === "developer"
      ? {
          warning:
            "Developers can see the API key. If they may have kept a copy, rotate the key from the Subscription page.",
        }
      : {}),
  };
}

/** Change someone between Developer and Member (plan §6.6). */
export async function changeRole(
  deps: TeamDeps,
  input: { actor: Actor; org: OrgContext; userId: string; role: string },
): Promise<TeamResult> {
  if (!isInvitableRole(input.role)) return { ok: false, error: "Choose Developer or Member" };
  const target = await loadMember(deps.db, input.org.orgId, input.userId);
  const problem = memberChangeProblem({ actorId: input.actor.id, target, change: "role" });
  if (problem) return { ok: false, error: problem };
  if (target?.role === input.role) return { ok: true, message: "No change." };

  const { error } = await deps.db
    .from("memberships")
    .update({ role: input.role })
    .eq("org_id", input.org.orgId)
    .eq("user_id", input.userId)
    .neq("role", "owner");
  if (error) throw new Error(`changing the role failed: ${error.message}`);
  return {
    ok: true,
    message: input.role === "developer" ? "They're now a Developer." : "They're now a Member.",
  };
}

/**
 * Plan §6.11: on approval, send the invites held while the organisation was
 * pending review. Each gets a new token (only hashes are stored) and its 14
 * days start now. Returns how many were sent.
 */
export async function sendHeldInvites(
  deps: TeamDeps,
  input: { orgId: string; orgName: string },
): Promise<number> {
  const held = await deps.db
    .from("invitations")
    .select("id, email, role, invited_by")
    .eq("org_id", input.orgId)
    .is("sent_at", null)
    .is("accepted_at", null)
    .is("revoked_at", null);
  if (held.error) throw new Error(`reading held invites failed: ${held.error.message}`);
  const rows = (held.data ?? []) as {
    id: string;
    email: string;
    role: InvitableRole;
    invited_by: string | null;
  }[];

  const now = deps.now?.() ?? new Date();
  const expiresAt = expiry(now);
  let sent = 0;
  for (const row of rows) {
    const token = newInviteToken();
    const { data, error } = await deps.db
      .from("invitations")
      .update({
        token_hash: hashInviteToken(token),
        sent_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", row.id)
      .is("sent_at", null)
      .select("id");
    if (error) throw new Error(`releasing the invite failed: ${error.message}`);
    if (!data?.length) continue;
    const inviterName = row.invited_by ? await displayName(deps.db, row.invited_by) : null;
    await deps.sendInvite(row.email, {
      orgName: input.orgName,
      inviterName: inviterName ?? input.orgName,
      role: row.role,
      token,
      expiresAt,
    });
    sent += 1;
  }
  return sent;
}

async function displayName(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", userId)
    .maybeSingle<{ email: string; first_name: string | null; last_name: string | null }>();
  if (!data) return null;
  return personName(data.first_name, data.last_name) ?? data.email;
}

export function personName(first: string | null, last: string | null): string | null {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || null;
}

// The join page (plan §6.6, JOIN-*).

export type InviteDetails = {
  orgId: string;
  orgName: string;
  email: string;
  role: InvitableRole;
  inviterName: string | null;
  /** Set when the invite can't be accepted, whoever opens it. */
  problem: Extract<TeamErrorHint, "accepted" | "revoked" | "held" | "expired"> | null;
  acceptedBy: string | null;
};

/** The invite behind a link, or null if there's no such invite. */
export async function lookupInvite(
  deps: Pick<TeamDeps, "db" | "now">,
  token: string,
): Promise<InviteDetails | null> {
  if (!isPlausibleToken(token)) return null;
  const { data, error } = await deps.db
    .from("invitations")
    .select(
      "org_id, email, role, invited_by, sent_at, expires_at, accepted_at, accepted_by, revoked_at, organisations (name)",
    )
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle<{
      org_id: string;
      email: string;
      role: InvitableRole;
      invited_by: string | null;
      sent_at: string | null;
      expires_at: string | null;
      accepted_at: string | null;
      accepted_by: string | null;
      revoked_at: string | null;
      organisations: { name: string } | null;
    }>();
  if (error) throw new Error(`reading the invite failed: ${error.message}`);
  if (!data) return null;

  const now = deps.now?.() ?? new Date();
  const problem: InviteDetails["problem"] = data.accepted_at
    ? "accepted"
    : data.revoked_at
      ? "revoked"
      : !data.sent_at
        ? "held"
        : data.expires_at && new Date(data.expires_at) <= now
          ? "expired"
          : null;

  return {
    orgId: data.org_id,
    orgName: data.organisations?.name ?? "your team",
    email: data.email,
    role: data.role,
    inviterName: data.invited_by ? await displayName(deps.db, data.invited_by) : null,
    problem,
    acceptedBy: data.accepted_by,
  };
}

export type AcceptResult =
  { ok: true; orgId: string } | { ok: false; hint: TeamErrorHint; detail: string | null };

/** JOIN-01 to JOIN-05: accept an invite for the signed-in user. */
export async function acceptInvite(
  deps: Pick<TeamDeps, "db">,
  input: { token: string; userId: string; move: boolean },
): Promise<AcceptResult> {
  if (!isPlausibleToken(input.token)) return { ok: false, hint: "not_found", detail: null };
  const { data, error } = await deps.db.rpc("accept_invitation", {
    p_token_hash: hashInviteToken(input.token),
    p_user_id: input.userId,
    p_move: input.move,
  });
  if (error) {
    const hint = teamErrorHint(error);
    if (hint) return { ok: false, hint, detail: error.details ?? null };
    throw new Error(`accepting the invite failed: ${error.message}`);
  }
  return { ok: true, orgId: String(data) };
}
