// Team rules (plan §3, §6.6; TEAM-*, JOIN-*), as pure functions.

import { teamFullMessage } from "@/lib/billing/seats";
import type { OrgRole } from "@/lib/nav";
import { normaliseDomain } from "@/lib/review/rules";

/** Invites expire after this many days (plan §6.6, §13.1). */
export const INVITE_EXPIRY_DAYS = 14;

/** The roles an owner can give when inviting or changing a role. */
export const INVITABLE_ROLES = ["developer", "member"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(value: unknown): value is InvitableRole {
  return value === "developer" || value === "member";
}

/** Invite, remove, withdraw and change roles: the owner only (TEAM-04, TEAM-08). */
export function canManageTeam(role: OrgRole | null | undefined): boolean {
  return role === "owner";
}

export const notOwnerMessage =
  "Only the account owner can change the team. Ask them to make this change.";

export function emailDomain(email: string): string | null {
  return normaliseDomain(email.split("@").pop());
}

/**
 * Why this address can't be invited, or null (TEAM-04). Invitees must share
 * the owner's email domain unless an admin has allowed other domains for the
 * organisation (plan §6.6).
 */
export function inviteDomainProblem(input: {
  ownerEmail: string;
  inviteeEmail: string;
  allowExternal: boolean;
}): string | null {
  const ownerDomain = emailDomain(input.ownerEmail);
  const domain = emailDomain(input.inviteeEmail);
  if (!domain) return "Enter a valid email address";
  if (input.allowExternal || !ownerDomain || domain === ownerDomain) return null;
  return `Invites must use your organisation's email domain (@${ownerDomain}). Contact us if you need to invite someone from another company.`;
}

/** Why a team change can't be made to this person, or null (TEAM-08). */
export function memberChangeProblem(input: {
  actorId: string;
  target: { userId: string; role: OrgRole } | null;
  change: "remove" | "role";
}): string | null {
  if (!input.target) return "That person isn't in your team.";
  if (input.target.userId === input.actorId) {
    return input.change === "remove"
      ? "You can't remove yourself from the team."
      : "You can't change your own role.";
  }
  if (input.target.role === "owner") {
    return "The owner can't be changed here. Contact us to transfer ownership.";
  }
  return null;
}

// The errors create_invitation and accept_invitation raise, by their hint.
export type TeamErrorHint =
  | "already_member"
  | "already_invited"
  | "team_full"
  | "not_found"
  | "accepted"
  | "revoked"
  | "held"
  | "expired"
  | "wrong_email"
  | "not_subscribed"
  | "owner_elsewhere"
  | "needs_consent";

const hints = new Set<string>([
  "already_member",
  "already_invited",
  "team_full",
  "not_found",
  "accepted",
  "revoked",
  "held",
  "expired",
  "wrong_email",
  "not_subscribed",
  "owner_elsewhere",
  "needs_consent",
]);

export function teamErrorHint(error: { hint?: string | null } | null): TeamErrorHint | null {
  return error?.hint && hints.has(error.hint) ? (error.hint as TeamErrorHint) : null;
}

/** "3/4" from the database's detail becomes the team-full message. */
export function teamFullFromDetail(detail: string | null | undefined): string {
  const [used, limit] = String(detail ?? "")
    .split("/")
    .map((n) => Number.parseInt(n, 10));
  return Number.isInteger(used) && Number.isInteger(limit)
    ? teamFullMessage(used, limit)
    : "Your team is full. Remove a member or withdraw an invite, or contact us to add seats.";
}

/** The message for an invite the owner couldn't send (TEAM-05). */
export function inviteErrorMessage(
  hint: TeamErrorHint | null,
  detail?: string | null,
): string | null {
  switch (hint) {
    case "already_member":
      return "That person is already in your team.";
    case "already_invited":
      return "That person already has an invite. You can resend it from the list below.";
    case "team_full":
      return teamFullFromDetail(detail);
    default:
      return null;
  }
}

/** What the join page says for each refusal (JOIN-02 to JOIN-06). */
export function joinErrorMessage(
  hint: TeamErrorHint,
  input: { orgName?: string; invitedEmail?: string; detail?: string | null } = {},
): string {
  const org = input.orgName ?? "the team";
  switch (hint) {
    case "not_found":
      return "This invite link isn't valid. Check you copied the whole link, or ask for a new invite.";
    case "accepted":
      return "This invite has already been used. Ask the account owner for a new one if you need it.";
    case "already_member":
      return "You've already joined your team.";
    case "revoked":
      return "This invite has been withdrawn. Ask the account owner for a new one.";
    case "held":
      return `${org} is still being set up. We'll email you when your invite is ready.`;
    case "expired":
      return `This invite has expired. Invites last ${INVITE_EXPIRY_DAYS} days; ask the account owner to send a new one.`;
    case "wrong_email":
      return `This invite was sent to ${input.invitedEmail ?? "a different address"}. Sign in with that email address to accept it.`;
    case "not_subscribed":
      return `${org} no longer has an active subscription, so you can't join it. Ask the account owner to check their plan.`;
    case "owner_elsewhere":
      return "You're the owner of another organisation, so you can't join a different one yourself. Contact us and we'll close your organisation or transfer it to someone else first.";
    case "needs_consent":
      return `Accepting will move you to ${org}. Tick the box to confirm.`;
    case "team_full":
      return input.detail ? teamFullFromDetail(input.detail) : "Your team is full.";
    case "already_invited":
      return "That person already has an invite.";
  }
}

/** When an invite expires, for display. */
export function inviteExpiryLabel(expiresAt: Date | null, now: Date): string {
  if (!expiresAt) return "Held until your account is approved";
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return "Expired";
  const days = Math.ceil(ms / 86_400_000);
  return days === 1 ? "Expires within a day" : `Expires in ${days} days`;
}
