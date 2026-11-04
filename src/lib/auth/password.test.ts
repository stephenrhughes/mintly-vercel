import { describe, expect, it } from "vitest";

import { passwordProblems } from "./password";

describe("passwordProblems (AUTH-02)", () => {
  it("accepts a password that meets every rule", () => {
    expect(passwordProblems("Mintly#2026")).toEqual([]);
  });

  it("names each rule that isn't met, in friendly words", () => {
    expect(passwordProblems("abc")).toEqual([
      "At least 8 characters",
      "Needs an upper case letter",
      "Needs a number",
      "Needs a symbol (e.g. ! @ # $)",
    ]);
    expect(passwordProblems("ABCDEFG1!")).toEqual(["Needs a lower case letter"]);
  });
});
