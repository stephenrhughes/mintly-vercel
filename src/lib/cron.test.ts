import { describe, expect, it } from "vitest";

import { isCronRequest } from "./cron";

const request = (authorization?: string) =>
  new Request("https://app.test/api/cron/reminders", {
    headers: authorization ? { authorization } : {},
  });

describe("isCronRequest (plan §8)", () => {
  it("accepts only the cron secret", () => {
    const env = { CRON_SECRET: "s3cret" };
    expect(isCronRequest(request("Bearer s3cret"), env)).toBe(true);
    expect(isCronRequest(request("Bearer wrong"), env)).toBe(false);
    expect(isCronRequest(request(), env)).toBe(false);
  });

  it("refuses everything when no secret is set", () => {
    expect(isCronRequest(request("Bearer "), {})).toBe(false);
    expect(isCronRequest(request("Bearer undefined"), {})).toBe(false);
  });
});
