import { describe, expect, it } from "vitest";

import { fakeBankResponse } from "./fake";
import { resultMessage, resultsToCsv, summarise } from "./results";
import type { CheckResult } from "./run";

const valid: CheckResult = {
  index: 0,
  input: "42-42-42,42424242",
  outcome: "valid",
  status: 200,
  body: fakeBankResponse("/sortcode/424242/account/42424242").body,
};

describe("summarise", () => {
  it("pulls out the bank, branch, IBAN and BIC (TOOL-06)", () => {
    expect(summarise(valid.body)).toEqual({
      bank: "MINTLY TEST BANK",
      branch: "SANDBOX BRANCH",
      sortCode: "424242",
      iban: "GB42SAND42424242424242",
      bic: "TEST4242XXX",
      message: "",
    });
  });

  it("copes with bodies that aren't objects", () => {
    expect(summarise(null).bank).toBe("");
  });
});

describe("resultMessage (TOOL-10)", () => {
  it("explains each outcome", () => {
    expect(resultMessage(valid)).toBe("MINTLY TEST BANK · GB42SAND42424242424242");
    expect(
      resultMessage({ index: 1, input: "x", outcome: "invalid", body: { Message: "Not found" } }),
    ).toBe("Not found");
    expect(resultMessage({ index: 2, input: "x", outcome: "rate_limited" })).toMatch(/limit/);
    expect(resultMessage({ index: 3, input: "x", outcome: "malformed", message: "Bad" })).toBe(
      "Bad",
    );
  });
});

describe("resultsToCsv (TOOL-11)", () => {
  it("writes a header and one row per line", () => {
    const csv = resultsToCsv([
      valid,
      { index: 1, input: "123456,1", outcome: "malformed", message: "Wrong, format" },
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe("status,input,bank,branch,sort_code,iban,bic,message");
    expect(lines[1]).toBe(
      'VALID,"42-42-42,42424242",MINTLY TEST BANK,SANDBOX BRANCH,424242,GB42SAND42424242424242,TEST4242XXX,',
    );
    expect(lines[2]).toBe('NOT CHECKED: WRONG FORMAT,"123456,1",,,,,,"Wrong, format"');
  });

  it("stops cells from being read as formulas", () => {
    const csv = resultsToCsv([{ index: 0, input: "=HYPERLINK(1)", outcome: "malformed" }]);
    expect(csv).toContain("'=HYPERLINK(1)");
  });
});
