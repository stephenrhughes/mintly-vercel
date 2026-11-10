import { describe, expect, it } from "vitest";

import { viewAsBlocksRequest } from "./view-as-guard";
import { signViewAs, VIEW_AS_SECONDS, verifyViewAs, viewAsSecret } from "./view-as-token";

const NOW = new Date("2026-06-01T12:00:00Z");
const SECRET = "test-secret";

describe("view-as tokens (ADM-13)", () => {
  const token = signViewAs({ adminId: "admin_1", targetUserId: "user_1", now: NOW }, SECRET);

  it("round-trips while it is fresh", () => {
    expect(verifyViewAs(token, SECRET, NOW)).toEqual({
      adminId: "admin_1",
      targetUserId: "user_1",
      expiresAt: Math.floor(NOW.getTime() / 1000) + VIEW_AS_SECONDS,
    });
  });

  it("expires after an hour", () => {
    expect(
      verifyViewAs(token, SECRET, new Date(NOW.getTime() + VIEW_AS_SECONDS * 1000)),
    ).toBeNull();
  });

  it("refuses a token signed with another secret, or changed", () => {
    expect(verifyViewAs(token, "other", NOW)).toBeNull();
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ a: "admin_1", t: "user_2", e: 9_999_999_999 }),
    ).toString("base64url");
    expect(verifyViewAs(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
    expect(verifyViewAs(`${payload}.${signature}.x`, SECRET, NOW)).toBeNull();
    expect(verifyViewAs("nonsense", SECRET, NOW)).toBeNull();
    expect(verifyViewAs(undefined, SECRET, NOW)).toBeNull();
    expect(verifyViewAs(token, null, NOW)).toBeNull();
  });

  it("uses VIEW_AS_SECRET, or derives one from the Supabase secret key", () => {
    expect(viewAsSecret({ VIEW_AS_SECRET: "x" })).toBe("x");
    const derived = viewAsSecret({ SUPABASE_SECRET_KEY: "sb_secret_1" });
    expect(derived).toMatch(/^[0-9a-f]{64}$/);
    expect(derived).not.toContain("sb_secret_1");
    expect(viewAsSecret({})).toBeNull();
  });
});

describe("viewAsBlocksRequest (ADM-13)", () => {
  const blocks = (method: string, appPathname: string, hasViewAsCookie = true) =>
    viewAsBlocksRequest({ method, appPathname, hasViewAsCookie });

  it("lets reads through and refuses writes while viewing as a customer", () => {
    expect(blocks("GET", "/team")).toBe(false);
    expect(blocks("HEAD", "/")).toBe(false);
    expect(blocks("POST", "/team")).toBe(true);
    expect(blocks("POST", "/admin/organisations/x")).toBe(true);
    expect(blocks("PUT", "/account")).toBe(true);
  });

  it("still lets the admin sign out or exit", () => {
    expect(blocks("POST", "/sign-out")).toBe(false);
    expect(blocks("POST", "/admin/view-as/exit/")).toBe(false);
  });

  it("does nothing without the cookie", () => {
    expect(blocks("POST", "/team", false)).toBe(false);
  });
});
