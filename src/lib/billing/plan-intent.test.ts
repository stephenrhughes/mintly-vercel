import { describe, expect, it } from "vitest";

import {
  decodeIntent,
  encodeIntent,
  intentFromNext,
  intentFromParams,
  resolveIntent,
} from "./plan-intent";

// BUY-02, after mintly-web pendingPlan.test.js.
describe("intentFromParams", () => {
  it("reads a tier, defaulting to monthly", () => {
    expect(intentFromParams({ plan: "standardPlus" })).toEqual({
      tier: "standardPlus",
      interval: "monthly",
    });
    expect(intentFromParams({ plan: "professional", interval: "annual" })).toEqual({
      tier: "professional",
      interval: "annual",
    });
  });

  it("rejects anything that isn't a tier, including prototype keys", () => {
    expect(intentFromParams({ plan: "price_123" })).toBeNull();
    expect(intentFromParams({ plan: "constructor" })).toBeNull();
    expect(intentFromParams({})).toBeNull();
  });

  it("ignores an unknown interval", () => {
    expect(intentFromParams({ plan: "starter", interval: "weekly" })?.interval).toBe("monthly");
  });
});

describe("intentFromNext", () => {
  it("reads the plan from a /subscribe next path", () => {
    expect(intentFromNext("/subscribe?plan=starter")?.tier).toBe("starter");
    expect(intentFromNext("/account?plan=starter")).toBeNull();
    expect(intentFromNext(null)).toBeNull();
  });
});

describe("cookie round trip", () => {
  it("encodes and decodes, and refuses tampered values", () => {
    const intent = { tier: "professional", interval: "annual" } as const;
    expect(decodeIntent(encodeIntent(intent))).toEqual(intent);
    expect(decodeIntent("enterprise:monthly")).toBeNull();
    expect(decodeIntent(undefined)).toBeNull();
  });
});

describe("resolveIntent", () => {
  it("prefers the query string over the cookie", () => {
    expect(resolveIntent({ plan: "starter" }, "professional:annual")?.tier).toBe("starter");
    expect(resolveIntent({}, "professional:annual")?.tier).toBe("professional");
    expect(resolveIntent({}, undefined)).toBeNull();
  });
});
