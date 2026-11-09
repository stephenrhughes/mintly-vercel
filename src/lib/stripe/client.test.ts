import { describe, expect, it } from "vitest";

import { isAllowedStripeKey, mockApiConfig } from "./client";

describe("isAllowedStripeKey (NFR-03)", () => {
  it("allows live keys on production only", () => {
    expect(isAllowedStripeKey("sk_live_x", { VERCEL_ENV: "production" })).toBe(true);
    expect(isAllowedStripeKey("sk_live_x", { VERCEL_ENV: "preview" })).toBe(false);
    expect(isAllowedStripeKey("rk_live_x", {})).toBe(false);
    expect(isAllowedStripeKey("sk_test_x", {})).toBe(true);
  });
});

describe("mockApiConfig", () => {
  it("points at a local mock outside production, and never on production", () => {
    expect(mockApiConfig({ STRIPE_API_URL: "http://localhost:12111" })).toEqual({
      host: "localhost",
      port: 12111,
      protocol: "http",
    });
    expect(
      mockApiConfig({ STRIPE_API_URL: "http://localhost:12111", VERCEL_ENV: "production" }),
    ).toEqual({});
    expect(mockApiConfig({})).toEqual({});
  });
});
