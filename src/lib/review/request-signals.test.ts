import { describe, expect, it } from "vitest";

import { hashIp, requestSignals } from "./request-signals";

describe("requestSignals (APPR-04)", () => {
  it("hashes the first forwarded IP and keeps the country, never the raw IP", () => {
    const signals = requestSignals(
      new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-vercel-ip-country": "gb" }),
      { IP_HASH_SECRET: "s" },
    );
    expect(signals).toEqual({
      signup_ip_hash: hashIp("203.0.113.7", { IP_HASH_SECRET: "s" }),
      signup_country: "GB",
    });
    expect(JSON.stringify(signals)).not.toContain("203.0.113.7");
  });

  it("gives the same hash for the same IP, so repeat trials can be matched", () => {
    const env = { IP_HASH_SECRET: "s" };
    expect(hashIp("203.0.113.7", env)).toBe(hashIp("203.0.113.7", env));
    expect(hashIp("203.0.113.7", env)).not.toBe(hashIp("203.0.113.8", env));
    expect(hashIp("203.0.113.7", env)).not.toBe(hashIp("203.0.113.7", { IP_HASH_SECRET: "t" }));
  });

  it("records no IP in production without a secret", () => {
    expect(hashIp("203.0.113.7", { VERCEL_ENV: "production" })).toBeNull();
  });

  it("leaves out what the request doesn't have", () => {
    expect(requestSignals(new Headers(), {})).toEqual({});
    expect(requestSignals(new Headers({ "x-vercel-ip-country": "nowhere" }), {})).toEqual({});
  });
});
