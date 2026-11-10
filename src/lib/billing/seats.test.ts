import { describe, expect, it } from "vitest";

import { parseSeats, seatLimit, teamFullMessage } from "./seats";

// Ported from mintly-web amplify/shared/tests/seats.test.js.
describe("parseSeats", () => {
  it.each([
    ["5", 5],
    [15, 15],
    ["0", undefined],
    ["-1", undefined],
    ["many", undefined],
    [undefined, undefined],
    [null, undefined],
  ])("reads %p as %p", (value, expected) => {
    expect(parseSeats(value)).toBe(expected);
  });
});

describe("seatLimit", () => {
  it("adds the subscription's extra users to the price's seats", () => {
    expect(seatLimit({ maxTeamSize: 1, extraUsers: 2 })).toBe(3);
    expect(seatLimit({ maxTeamSize: "5", extraUsers: "0" })).toBe(5);
    expect(seatLimit({ maxTeamSize: 15 })).toBe(15);
  });

  it("is unknown, not zero, when there is no maxTeamSize", () => {
    expect(seatLimit({ maxTeamSize: null, extraUsers: 2 })).toBeNull();
  });
});

describe("teamFullMessage", () => {
  it("says how many seats are used", () => {
    expect(teamFullMessage(5, 5)).toMatch(/^Your team is full \(5 of 5 seats used\)/);
  });
});
