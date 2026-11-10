// The app menu (requirements §15.4: NAV-13, NAV-14, NAV-18, NAV-19).
// Items a role may never use are left out; items that are only unavailable
// for now are shown disabled with the reason.

import { siteConfig } from "@/lib/site";

export type OrgRole = "owner" | "developer" | "member";
export type ReviewStatus = "pending_review" | "approved" | "rejected" | "suspended";

export type NavContext = {
  role: OrgRole | null;
  reviewStatus: ReviewStatus | null;
  isMintlyAdmin: boolean;
};

export type NavIcon =
  | "overview"
  | "tools"
  | "usage"
  | "key"
  | "docs"
  | "guides"
  | "releases"
  | "team"
  | "billing"
  | "subscription"
  | "account"
  | "reviews"
  | "organisations"
  | "reports"
  | "plans"
  | "offers"
  | "sso"
  | "admins"
  | "feedback";

export type NavItem = {
  id: string;
  label: string;
  /** App-relative path, or an absolute URL when external. */
  href: string;
  icon: NavIcon;
  external?: boolean;
  /** Set when the item is shown but can't be used yet. */
  disabledReason?: string;
};

export type NavGroup = { id: string; label: string; items: NavItem[]; admin?: boolean };

// Pages that later delivery phases add (plan §11). Their items stay in the
// menu, disabled, so the menu doesn't change shape as they arrive. Remove a
// path from here when its page ships.
const notYetAvailable = new Set(["/billing"]);

const COMING_SOON = "Coming soon";

function item(
  id: string,
  label: string,
  href: string,
  icon: NavIcon,
  disabledReason?: string,
): NavItem {
  const path = href.split("#")[0];
  const reason = disabledReason ?? (notYetAvailable.has(path) ? COMING_SOON : undefined);
  return { id, label, href, icon, ...(reason ? { disabledReason: reason } : {}) };
}

function external(id: string, label: string, path: string, icon: NavIcon): NavItem {
  // Opens the public docs until they are served inside the app (NAV-17, phase 6).
  return { id, label, href: `${siteConfig.canonicalUrl}${path}`, icon, external: true };
}

/** Why the organisation's tools and key can't be used, if they can't. */
function accessProblem(ctx: NavContext): { tools?: string; key?: string } {
  if (!ctx.role) {
    return { tools: "Choose a plan first", key: "Available once you have a plan" };
  }
  switch (ctx.reviewStatus) {
    case "pending_review":
      // Tools opens the sandbox while pending (APPR-03).
      return { key: "Available once your account is approved" };
    case "rejected":
      return { tools: "Your account wasn't approved", key: "Your account wasn't approved" };
    case "suspended":
      return { tools: "Your account is suspended", key: "Your account is suspended" };
    default:
      return {};
  }
}

export function buildNav(ctx: NavContext): NavGroup[] {
  const problem = accessProblem(ctx);
  const hasOrg = ctx.role !== null;
  const noOrgReason = hasOrg ? undefined : "Choose a plan first";

  const developers: NavItem[] = [];
  if (ctx.role !== "member") {
    developers.push(item("api-key", "API key", "/subscription#api-key", "key", problem.key));
  }
  developers.push(
    external("docs", "Documentation", "/docs", "docs"),
    external("guides", "Integration guides", "/integration-guides", "guides"),
    external("releases", "Release notes", "/release-notes", "releases"),
  );

  const organisation: NavItem[] = [item("team", "Team", "/team", "team", noOrgReason)];
  if (ctx.role === "owner") organisation.push(item("billing", "Billing", "/billing", "billing"));
  // With no organisation, Subscription leads to the plans (NAV-18).
  organisation.push(
    hasOrg
      ? item("subscription", "Subscription", "/subscription", "subscription")
      : item("subscription", "Choose a plan", "/subscribe", "subscription"),
  );

  const groups: NavGroup[] = [
    {
      id: "work",
      label: "Work",
      items: [
        item("overview", "Overview", "/", "overview"),
        item("tools", "Tools", "/tools", "tools", problem.tools),
        item("usage", "Usage", "/usage", "usage", noOrgReason),
      ],
    },
    { id: "developers", label: "Developers", items: developers },
    { id: "organisation", label: "Organisation", items: organisation },
    {
      id: "account",
      label: "Account",
      items: [item("account", "Account settings", "/account", "account")],
    },
  ];

  if (ctx.isMintlyAdmin) {
    groups.push({
      id: "admin",
      label: "Admin",
      admin: true,
      items: [
        item("admin-overview", "Admin overview", "/admin", "overview"),
        item("admin-reviews", "Reviews", "/admin/reviews", "reviews"),
        item("admin-organisations", "Organisations", "/admin/organisations", "organisations"),
        item("admin-reports", "Reports", "/admin/reports", "reports"),
        item("admin-plans", "Plans", "/admin/plans", "plans"),
        item("admin-offers", "Offers", "/admin/offers", "offers"),
        item("admin-sso", "SSO", "/admin/sso", "sso"),
        item("admin-admins", "Admins", "/admin/admins", "admins"),
        item("admin-feedback", "Feedback", "/admin/feedback", "feedback"),
      ],
    });
  }

  return groups;
}

/** The status line under the organisation name in the sidebar (NAV-15). */
export function orgStatusLabel(reviewStatus: ReviewStatus | null): string {
  switch (reviewStatus) {
    case null:
      return "No plan yet";
    case "pending_review":
      return "Pending review";
    case "approved":
      return "Active";
    case "rejected":
      return "Not approved";
    case "suspended":
      return "Suspended";
  }
}

export const roleLabels: Record<OrgRole, string> = {
  owner: "Owner",
  developer: "Developer",
  member: "Member",
};
