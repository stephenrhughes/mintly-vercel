import { describe, expect, it } from "vitest";

import { hashInviteToken, isPlausibleToken, newInviteToken } from "./tokens";

describe("invite tokens", () => {
  it("are long, random and URL-safe", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isPlausibleToken(a)).toBe(true);
  });

  it("are stored as a SHA-256 hash", () => {
    expect(hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("rejects values that can't be tokens", () => {
    expect(isPlausibleToken("short")).toBe(false);
    expect(isPlausibleToken("has spaces in it here")).toBe(false);
    expect(isPlausibleToken("x".repeat(200))).toBe(false);
    // Old invite IDs from the current platform (UUIDs) still pass.
    expect(isPlausibleToken("3f2b9c1e-8a4d-4c4e-9b8a-1d2e3f4a5b6c")).toBe(true);
  });
});
