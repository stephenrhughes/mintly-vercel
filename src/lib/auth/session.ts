import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { appPath } from "@/lib/hosts";
import type { OrgRole, ReviewStatus } from "@/lib/nav";
import { getSupabaseConfig } from "@/lib/supabase/config";
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
