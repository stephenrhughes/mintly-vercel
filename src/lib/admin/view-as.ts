import "server-only";

import { cookies } from "next/headers";

import { createServiceClient } from "@/lib/supabase/admin";

import { recordAudit } from "./audit";
import {
  signViewAs,
  VIEW_AS_COOKIE,
  VIEW_AS_SECONDS,
  viewAsSecret,
  verifyViewAs,
} from "./view-as-token";

// Starting and ending a view-as session (ADM-13). Each start and end is
// audited. Callers have already passed requireAdmin().

export type ViewAsTarget = {
  userId: string;
  email: string;
  name: string | null;
  orgId: string | null;
  orgName: string | null;
  role: string | null;
  isMintlyAdmin: boolean;
};

export async function loadViewAsTarget(userId: string): Promise<ViewAsTarget | null> {
  const db = createServiceClient();
  const [{ data: profile }, { data: membership }] = await Promise.all([
    db
      .from("profiles")
      .select("email, first_name, last_name, is_mintly_admin")
      .eq("id", userId)
      .maybeSingle<{
        email: string;
        first_name: string | null;
        last_name: string | null;
        is_mintly_admin: boolean;
      }>(),
    db
      .from("memberships")
      .select("org_id, role, organisations (name)")
      .eq("user_id", userId)
      .maybeSingle<{ org_id: string; role: string; organisations: { name: string } | null }>(),
  ]);
  if (!profile) return null;
  return {
    userId,
    email: profile.email,
    name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null,
    orgId: membership?.org_id ?? null,
    orgName: membership?.organisations?.name ?? null,
    role: membership?.role ?? null,
    isMintlyAdmin: profile.is_mintly_admin,
  };
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

export async function startViewAs(admin: { id: string }, target: ViewAsTarget): Promise<void> {
  const secret = viewAsSecret();
  if (!secret) throw new Error("View as needs VIEW_AS_SECRET or SUPABASE_SECRET_KEY.");
  await recordAudit(createServiceClient(), {
    actorId: admin.id,
    orgId: target.orgId,
    action: "view_as.start",
    details: { user_id: target.userId, email: target.email },
  });
  (await cookies()).set(
    VIEW_AS_COOKIE,
    signViewAs({ adminId: admin.id, targetUserId: target.userId, now: new Date() }, secret),
    { ...cookieOptions, maxAge: VIEW_AS_SECONDS },
  );
}

/** Ends the session, audited; returns the organisation that was being viewed. */
export async function endViewAs(admin: { id: string }): Promise<string | null> {
  const store = await cookies();
  const session = verifyViewAs(store.get(VIEW_AS_COOKIE)?.value, viewAsSecret(), new Date());
  store.delete(VIEW_AS_COOKIE);
  if (!session || session.adminId !== admin.id) return null;
  const target = await loadViewAsTarget(session.targetUserId);
  await recordAudit(createServiceClient(), {
    actorId: admin.id,
    orgId: target?.orgId ?? null,
    action: "view_as.end",
    details: { user_id: session.targetUserId, email: target?.email ?? null },
  });
  return target?.orgId ?? null;
}
