import { describe, expect, it } from "vitest";

import type { OrgRole, ReviewStatus } from "@/lib/nav";

import { canManageBilling, canSeeKey } from "./permissions";

const who = (role: OrgRole, reviewStatus: ReviewStatus = "approved") => ({ role, reviewStatus });

// The role matrix in plan §3.
describe("canSeeKey", () => {
  it("lets owners and developers of an approved organisation see the key", () => {
    expect(canSeeKey(who("owner"))).toBe(true);
    expect(canSeeKey(who("developer"))).toBe(true);
  });

  it("never shows the key to members (Q1)", () => {
    expect(canSeeKey(who("member"))).toBe(false);
  });

  it("shows no key before approval, or after rejection or suspension (APPR-01)", () => {
    for (const status of ["pending_review", "rejected", "suspended"] as const) {
      expect(canSeeKey(who("owner", status))).toBe(false);
    }
    expect(canSeeKey(null)).toBe(false);
  });
});

describe("canManageBilling (BILL-01)", () => {
  it("is for the owner only", () => {
    expect(canManageBilling(who("owner"))).toBe(true);
    expect(canManageBilling(who("developer"))).toBe(false);
    expect(canManageBilling(who("member"))).toBe(false);
    expect(canManageBilling(null)).toBe(false);
  });
});
