import "server-only";

import type { OrgRole } from "@/lib/nav";
import { portalDb } from "@/lib/auth/session";

import { personName } from "./operations";

// The team page, read as the signed-in user so RLS limits it to their own
// organisation (TEAM-02). Invitations are only visible to the owner (plan §4).

export type TeamMember = {
  userId: string;
  name: string | null;
  email: string;
  role: OrgRole;
  joinedAt: Date;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: OrgRole;
  createdAt: Date;
  /** Null while held for review. */
  expiresAt: Date | null;
};

export type SeatUsage = { limit: number | null; members: number; pendingInvites: number };

export type TeamView = {
  members: TeamMember[];
  /** Only read for owners; empty for everyone else. */
  invites: PendingInvite[];
  seats: SeatUsage;
};

const roleOrder: Record<OrgRole, number> = { owner: 0, developer: 1, member: 2 };

export async function getTeam(orgId: string, opts: { withInvites: boolean }): Promise<TeamView> {
  const supabase = await portalDb();
  const [memberships, seats, invites] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, joined_at")
      .eq("org_id", orgId)
      .returns<{ user_id: string; role: OrgRole; joined_at: string }[]>(),
    getSeatUsage(orgId),
    opts.withInvites
      ? supabase
          .from("invitations")
          .select("id, email, role, created_at, expires_at")
          .eq("org_id", orgId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: true })
          .returns<
            {
              id: string;
              email: string;
              role: OrgRole;
              created_at: string;
              expires_at: string | null;
            }[]
          >()
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (memberships.error) throw new Error(`reading the team failed: ${memberships.error.message}`);
  if (invites.error) throw new Error(`reading invites failed: ${invites.error.message}`);

  const ids = memberships.data.map((m) => m.user_id);
  const profiles = ids.length
    ? await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", ids)
        .returns<
          { id: string; email: string; first_name: string | null; last_name: string | null }[]
        >()
    : { data: [], error: null };
  if (profiles.error) throw new Error(`reading profiles failed: ${profiles.error.message}`);
  const byId = new Map(profiles.data.map((p) => [p.id, p]));

  const members = memberships.data
    .map((m) => {
      const profile = byId.get(m.user_id);
      return {
        userId: m.user_id,
        name: profile ? personName(profile.first_name, profile.last_name) : null,
        email: profile?.email ?? "",
        role: m.role,
        joinedAt: new Date(m.joined_at),
      };
    })
    .sort(
      (a, b) =>
        roleOrder[a.role] - roleOrder[b.role] || a.joinedAt.getTime() - b.joinedAt.getTime(),
    );

  return {
    members,
    invites: (invites.data ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      createdAt: new Date(i.created_at),
      expiresAt: i.expires_at ? new Date(i.expires_at) : null,
    })),
    seats,
  };
}

type SeatRow = { seat_limit: number | null; members: number; pending_invites: number };

/** Seats used and the limit (TEAM-03), for the caller's own organisation. */
export async function getSeatUsage(orgId: string): Promise<SeatUsage> {
  const supabase = await portalDb();
  const { data, error } = await supabase.rpc("org_seat_usage", { p_org: orgId });
  if (error) throw new Error(`reading seats failed: ${error.message}`);
  const row = (data as SeatRow[] | null)?.[0];
  return {
    limit: row?.seat_limit ?? null,
    members: row?.members ?? 0,
    pendingInvites: row?.pending_invites ?? 0,
  };
}
