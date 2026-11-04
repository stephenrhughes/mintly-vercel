import { describe, expect, it } from "vitest";

import { isRecentEmailVerification } from "./recovery";

const now = Date.UTC(2026, 10, 4, 12, 0, 0);
const secondsAgo = (s: number) => Math.floor(now / 1000) - s;

describe("isRecentEmailVerification", () => {
  it("accepts a reset link followed in the last 15 minutes", () => {
    expect(isRecentEmailVerification([{ method: "otp", timestamp: secondsAgo(60) }], now)).toBe(
      true,
    );
    expect(
      isRecentEmailVerification([{ method: "recovery", timestamp: secondsAgo(600) }], now),
    ).toBe(true);
  });

  it("refuses an ordinary or old session", () => {
    expect(
      isRecentEmailVerification([{ method: "password", timestamp: secondsAgo(10) }], now),
    ).toBe(false);
    expect(
      isRecentEmailVerification([{ method: "otp", timestamp: secondsAgo(16 * 60) }], now),
    ).toBe(false);
    expect(isRecentEmailVerification(["otp"], now)).toBe(false);
    expect(isRecentEmailVerification(undefined, now)).toBe(false);
  });
});
