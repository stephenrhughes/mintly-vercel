import { describe, expect, it } from "vitest";

import {
  hasCookie,
  hasReachedLimit,
  nextMondayMidnight,
  promptAfterCheck,
  readCookie,
  readFreeTries,
  remainingChecks,
  triesCookie,
} from "./logic";

// Ported from mintly-web tryItLogic.test.js (FREE-03, FREE-04).
describe("reading cookies", () => {
  it("reads a value by exact name", () => {
    expect(readCookie("a=1; mly_ckk=4; b=2", "mly_ckk")).toBe("4");
    expect(readCookie("xmly_ckk=9", "mly_ckk")).toBeUndefined();
    expect(hasCookie("mly_rated=true", "mly_rated")).toBe(true);
    expect(hasCookie("", "mly_rated")).toBe(false);
  });

  it("treats a missing, blank or garbled count as zero, and caps it at the limit", () => {
    expect(readFreeTries("")).toBe(0);
    expect(readFreeTries("mly_ckk=")).toBe(0);
    expect(readFreeTries("mly_ckk=abc")).toBe(0);
    expect(readFreeTries("mly_ckk=-3")).toBe(0);
    expect(readFreeTries("mly_ckk=7")).toBe(7);
    expect(readFreeTries("mly_ckk=99")).toBe(10);
  });
});

describe("the weekly reset", () => {
  it("expires at the start of next Monday", () => {
    // Wednesday 11 November 2026, 15:30 local time.
    const reset = nextMondayMidnight(new Date(2026, 10, 11, 15, 30));
    expect([reset.getFullYear(), reset.getMonth(), reset.getDate(), reset.getHours()]).toEqual([
      2026, 10, 16, 0,
    ]);
  });

  it("goes to the following Monday when it is already Monday", () => {
    const reset = nextMondayMidnight(new Date(2026, 10, 9, 0, 5));
    expect(reset.getDate()).toBe(16);
  });

  it("writes a lax, path-wide cookie that expires then", () => {
    const cookie = triesCookie(4, new Date(2026, 10, 11, 15, 30));
    expect(cookie).toMatch(/^mly_ckk=4; Path=\/; Expires=.*; SameSite=Lax$/);
  });
});

describe("limits and prompts", () => {
  it("counts down to the weekly limit", () => {
    expect(remainingChecks(0)).toBe(10);
    expect(remainingChecks(9)).toBe(1);
    expect(remainingChecks(12)).toBe(0);
    expect(hasReachedLimit(9)).toBe(false);
    expect(hasReachedLimit(10)).toBe(true);
  });

  it("asks for a rating on exactly the third check, once", () => {
    expect(promptAfterCheck(2)).toBeNull();
    expect(promptAfterCheck(3)).toBe("rating");
    expect(promptAfterCheck(4)).toBeNull();
    expect(promptAfterCheck(3, { alreadyRated: true })).toBeNull();
  });

  it("offers a trial from the eighth check until it is dismissed", () => {
    expect(promptAfterCheck(7)).toBeNull();
    expect(promptAfterCheck(8)).toBe("offer");
    expect(promptAfterCheck(10)).toBe("offer");
    expect(promptAfterCheck(9, { offerDismissed: true })).toBeNull();
  });
});
