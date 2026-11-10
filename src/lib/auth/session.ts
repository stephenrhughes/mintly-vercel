import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { VIEW_AS_COOKIE, verifyViewAs, viewAsSecret } from "@/lib/admin/view-as-token";

import { appPath } from "@/lib/hosts";
import type { OrgRole, ReviewStatus } from "@/lib/nav";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// The data access layer for the signed-in user (plan §9, NFR-01). Pages,
// Server Actions and Route Handlers call these instead of reading the
// session themselves, and every one of them re-checks on the server.

export type Membership = {
  orgId: string;
  orgName: string;
  role: OrgRole;
  reviewStatus: ReviewStatus;
};

export type AppUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  phone: string | null;
  marketingOptOut: boolean;
  isMintlyAdmin: boolean;
  /** Signed in through SAML SSO; such users have no password here (SSO-06). */
  isSso: boolean;
  /** The session's assurance level: aal2 once MFA has been completed. */
  aal: "aal1" | "aal2";
  /** Has a verified authenticator app (SEC-01). */
  hasMfa: boolean;
  membership: Membership | null;
  /**
   * Set when a Mintly admin is viewing the portal as this user (ADM-13):
   * everything is read-only and the key is hidden.
   */
  viewAs?: { adminId: string; adminEmail: string } | null;
};

type ProfileRow = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  marketing_opt_out: boolean;
  is_mintly_admin: boolean;
};

type MembershipRow = {
  role: OrgRole;
  organisations: { id: string; name: string; review_status: ReviewStatus } | null;
};

/** The signed-in user, or null. Verified with Supabase Auth, once per request. */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  if (!getSupabaseConfig()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [aalResult, profileResult, membershipResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase
      .from("profiles")
      .select(
        "email, first_name, last_name, company_name, phone, marketing_opt_out, is_mintly_admin",
      )
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
    supabase
      .from("memberships")
      .select("role, organisations (id, name, review_status)")
      .eq("user_id", user.id)
      .maybeSingle<MembershipRow>(),
  ]);

  const profile = profileResult.data;
  const membershipRow = membershipResult.data;
  const org = membershipRow?.organisations;

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    companyName: profile?.company_name ?? null,
    phone: profile?.phone ?? null,
    marketingOptOut: profile?.marketing_opt_out ?? false,
    isMintlyAdmin: profile?.is_mintly_admin ?? false,
    isSso: (user.app_metadata?.provider ?? "").startsWith("sso"),
    aal: aalResult.data?.currentLevel === "aal2" ? "aal2" : "aal1",
    hasMfa: (user.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified"),
    membership:
      membershipRow && org
        ? {
            orgId: org.id,
            orgName: org.name,
            role: membershipRow.role,
            reviewStatus: org.review_status,
          }
        : null,
  };
});

function signInPath(next: string) {
  return appPath(`/sign-in?next=${encodeURIComponent(next)}`);
}

/**
 * The signed-in user, or a redirect to sign-in. A user who has turned on
 * MFA must complete it before they see anything (SEC-01).
 */
export async function requireUser(next = "/"): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(next));
  if (user.hasMfa && user.aal !== "aal2") {
    redirect(appPath(`/sign-in/mfa?next=${encodeURIComponent(next)}`));
  }
  return user;
}

/**
 * A Mintly admin who has completed MFA (SEC-01, plan §6.1). Anyone else gets
 * a 404, so the admin area isn't advertised. An admin without an
 * authenticator app is sent to set one up.
 */
export async function requireAdmin(next = "/admin"): Promise<AppUser> {
  const user = await requireUser(next);
  if (!user.isMintlyAdmin) notFound();
  if (!user.hasMfa) redirect(appPath("/account/security?required=admin"));
  return user;
}

// View as customer (ADM-13, NAV-19). An admin who has completed MFA can view
// the portal as a chosen user, read-only. Portal pages call
// requirePortalViewer() instead of requireUser(), and read through
// portalDb(), which is the user's own RLS client unless a valid view-as
// session is on. src/proxy.ts refuses every write while one is.

/** The admin's view-as session, if there is a valid one for the signed-in admin. */
export const getViewAsSession = cache(async () => {
  const token = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!token) return null;
  const session = verifyViewAs(token, viewAsSecret(), new Date());
  if (!session) return null;
  const admin = await getCurrentUser();
  if (
    !admin?.isMintlyAdmin ||
    !admin.hasMfa ||
    admin.aal !== "aal2" ||
    admin.id !== session.adminId
  ) {
    return null;
  }
  return { session, admin };
});

/** Any user, read with the service role. Only for an admin's view-as session. */
async function loadUserForViewAs(userId: string): Promise<AppUser | null> {
  const db = createServiceClient();
  const [profileResult, membershipResult, authResult] = await Promise.all([
    db
      .from("profiles")
      .select(
        "email, first_name, last_name, company_name, phone, marketing_opt_out, is_mintly_admin",
      )
      .eq("id", userId)
      .maybeSingle<ProfileRow>(),
    db
      .from("memberships")
      .select("role, organisations (id, name, review_status)")
      .eq("user_id", userId)
      .maybeSingle<MembershipRow>(),
    db.auth.admin.getUserById(userId),
  ]);
  const profile = profileResult.data;
  if (!profile) return null;
  const membershipRow = membershipResult.data;
  const org = membershipRow?.organisations;
  const authUser = authResult.data?.user;
  return {
    id: userId,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    companyName: profile.company_name,
    phone: profile.phone,
    marketingOptOut: profile.marketing_opt_out,
    isMintlyAdmin: profile.is_mintly_admin,
    isSso: (authUser?.app_metadata?.provider ?? "").startsWith("sso"),
    aal: "aal1",
    hasMfa: (authUser?.factors ?? []).some(
      (f) => f.factor_type === "totp" && f.status === "verified",
    ),
    membership:
      membershipRow && org
        ? {
            orgId: org.id,
            orgName: org.name,
            role: membershipRow.role,
            reviewStatus: org.review_status,
          }
        : null,
  };
}

/**
 * Whose portal this is: the signed-in user, or, during an admin's view-as
 * session, the user being viewed (with `viewAs` set).
 */
export const requirePortalViewer = cache(async (next = "/"): Promise<AppUser> => {
  const user = await requireUser(next);
  const viewAs = await getViewAsSession();
  if (!viewAs) return user;
  const target = await loadUserForViewAs(viewAs.session.targetUserId);
  if (!target) return user;
  return { ...target, viewAs: { adminId: viewAs.admin.id, adminEmail: viewAs.admin.email } };
});

/**
 * The client portal pages read with: the signed-in user's own (RLS), or the
 * service role during a verified admin's view-as session. Every portal
 * query filters by the viewer's organisation or user ID itself.
 */
export const portalDb = cache(async (): Promise<SupabaseClient> => {
  return (await getViewAsSession()) ? createServiceClient() : createClient();
});
