import { describe, expect, it } from "vitest";

import { latestEiscdRelease } from "./eiscd-release";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("latestEiscdRelease", () => {
  it("is today on a Friday", () => {
    expect(iso(latestEiscdRelease(new Date("2026-11-06T09:00:00Z")))).toBe("2026-11-06");
  });

  it("goes back to the previous Friday on other days", () => {
    expect(iso(latestEiscdRelease(new Date("2026-11-07T09:00:00Z")))).toBe("2026-11-06");
    expect(iso(latestEiscdRelease(new Date("2026-11-10T23:00:00Z")))).toBe("2026-11-06");
    expect(iso(latestEiscdRelease(new Date("2026-11-12T00:30:00Z")))).toBe("2026-11-06");
  });

  it("crosses a month boundary", () => {
    expect(iso(latestEiscdRelease(new Date("2026-12-02T12:00:00Z")))).toBe("2026-11-27");
  });
});
