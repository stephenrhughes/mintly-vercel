import { describe, expect, it } from "vitest";

import { buildNav, type NavContext, orgStatusLabel } from "./nav";

const ids = (ctx: NavContext) =>
  Object.fromEntries(buildNav(ctx).map((group) => [group.id, group.items.map((i) => i.id)]));

const find = (ctx: NavContext, id: string) =>
  buildNav(ctx)
    .flatMap((group) => group.items)
    .find((i) => i.id === id);

const approved = (role: NavContext["role"]): NavContext => ({
  role,
  reviewStatus: "approved",
  isMintlyAdmin: false,
});

// NAV-13 and NAV-14, from the role matrix in plan §3 (APPT-03).
describe("buildNav by role", () => {
  it("gives the owner every customer item", () => {
    expect(ids(approved("owner"))).toEqual({
      work: ["overview", "tools", "usage"],
      developers: ["api-key", "docs", "guides", "releases"],
      organisation: ["team", "billing", "subscription"],
      account: ["account"],
    });
  });

  it("hides billing from developers", () => {
    expect(ids(approved("developer")).organisation).toEqual(["team", "subscription"]);
    expect(ids(approved("developer")).developers).toContain("api-key");
  });

  it("hides the key and billing from members", () => {
    const member = ids(approved("member"));
    expect(member.developers).toEqual(["docs", "guides", "releases"]);
    expect(member.organisation).toEqual(["team", "subscription"]);
  });

  it("adds the admin group only for Mintly admins (NAV-19)", () => {
    expect(ids(approved("owner")).admin).toBeUndefined();
    const admin = buildNav({ role: null, reviewStatus: null, isMintlyAdmin: true });
    const group = admin.find((g) => g.id === "admin");
    expect(group?.admin).toBe(true);
    expect(group?.items.map((i) => i.label)).toEqual([
      "Admin overview",
      "Reviews",
      "Organisations",
      "Reports",
      "Plans",
      "Offers",
      "SSO",
      "Admins",
      "Feedback",
    ]);
    expect(group?.items[0].disabledReason).toBeUndefined();
  });

  it("opens the admin pages phase 5 has shipped", () => {
    const admin = buildNav({ role: null, reviewStatus: null, isMintlyAdmin: true });
    const items = admin.find((g) => g.id === "admin")?.items ?? [];
    const open = items.filter((i) => !i.disabledReason).map((i) => i.id);
    expect(open).toEqual(
      expect.arrayContaining([
        "admin-overview",
        "admin-reviews",
        "admin-organisations",
        "admin-plans",
      ]),
    );
  });
});

describe("buildNav availability", () => {
  it("shows a user with no organisation the same menu, with reasons (NAV-18)", () => {
    const ctx: NavContext = { role: null, reviewStatus: null, isMintlyAdmin: false };
    expect(ids(ctx)).toEqual({
      work: ["overview", "tools", "usage"],
      developers: ["api-key", "docs", "guides", "releases"],
      organisation: ["team", "subscription"],
      account: ["account"],
    });
    expect(find(ctx, "tools")?.disabledReason).toBe("Choose a plan first");
    expect(find(ctx, "api-key")?.disabledReason).toBe("Available once you have a plan");
    expect(find(ctx, "subscription")).toMatchObject({ label: "Choose a plan", href: "/subscribe" });
    expect(find(ctx, "overview")?.disabledReason).toBeUndefined();
    expect(find(ctx, "account")?.disabledReason).toBeUndefined();
  });

  it("keeps tools (in sandbox mode) but not the key while pending review (NAV-14, APPR-03)", () => {
    const ctx: NavContext = { role: "owner", reviewStatus: "pending_review", isMintlyAdmin: false };
    expect(find(ctx, "api-key")?.disabledReason).toBe("Available once your account is approved");
    expect(find(ctx, "tools")?.disabledReason).toBeUndefined();
    expect(find(ctx, "usage")?.disabledReason).toBeUndefined();
  });

  it("opens Tools and Usage to every role now that phase 3 has shipped them", () => {
    for (const role of ["owner", "developer", "member"] as const) {
      expect(find(approved(role), "tools")?.disabledReason).toBeUndefined();
      expect(find(approved(role), "usage")?.disabledReason).toBeUndefined();
    }
  });

  it("disables tools and the key when suspended", () => {
    const ctx: NavContext = { role: "developer", reviewStatus: "suspended", isMintlyAdmin: false };
    expect(find(ctx, "tools")?.disabledReason).toBe("Your account is suspended");
    expect(find(ctx, "api-key")?.disabledReason).toBe("Your account is suspended");
  });

  it("opens the subscription, plans and API key now that phase 2a has shipped them", () => {
    expect(find(approved("owner"), "subscription")?.disabledReason).toBeUndefined();
    expect(find(approved("developer"), "api-key")?.disabledReason).toBeUndefined();
    const noOrg: NavContext = { role: null, reviewStatus: null, isMintlyAdmin: false };
    expect(find(noOrg, "subscription")?.disabledReason).toBeUndefined();
    // Trial review arrived in phase 2b.
    const admin = buildNav({ role: null, reviewStatus: null, isMintlyAdmin: true });
    const reviews = admin.flatMap((g) => g.items).find((i) => i.id === "admin-reviews");
    expect(reviews?.disabledReason).toBeUndefined();
    // Billing contacts arrive in phase 7.
    expect(find(approved("owner"), "billing")?.disabledReason).toBe("Coming soon");
  });

  it("links docs to the public site", () => {
    expect(find(approved("member"), "docs")).toMatchObject({
      external: true,
      href: "https://www.mintly.uk/docs",
    });
  });
});

describe("orgStatusLabel (NAV-15)", () => {
  it("names each status", () => {
    expect(orgStatusLabel(null)).toBe("No plan yet");
    expect(orgStatusLabel("pending_review")).toBe("Pending review");
    expect(orgStatusLabel("approved")).toBe("Active");
  });
});
