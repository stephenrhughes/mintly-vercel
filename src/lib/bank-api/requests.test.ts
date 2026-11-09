import { describe, expect, it } from "vitest";

import {
  bicRequest,
  ibanRequest,
  isValidAccountNumber,
  isValidBic,
  isValidIban,
  isValidSortCode,
  normaliseBic,
  parseBulkLine,
  sortCodeRequest,
  splitBulkInput,
} from "./requests";

describe("validators (ported from mintly-web Tools.js)", () => {
  it.each([
    ["123456", true],
    ["12-34-56", true],
    ["12 34 56", false],
    ["12345", false],
    ["1234567", false],
    ["12-3456", false],
  ])("sort code %p is %p (TOOL-03)", (value, expected) => {
    expect(isValidSortCode(value)).toBe(expected);
  });

  it.each([
    ["", true],
    ["123456", true],
    ["1234567890", true],
    ["12345", false],
    ["12345678901", false],
    ["1234567a", false],
  ])("account number %p is %p", (value, expected) => {
    expect(isValidAccountNumber(value)).toBe(expected);
  });

  it("accepts IBANs typed with spaces (TOOL-04)", () => {
    expect(isValidIban("GB42 SAND 4242 4242 4242 42")).toBe(true);
    expect(isValidIban("GB42")).toBe(false);
  });

  it("pads 8-character BICs with X (TOOL-05)", () => {
    expect(isValidBic("HLFXGB21")).toBe(true);
    expect(isValidBic("HLFX GB21 D70")).toBe(true);
    expect(isValidBic("HLFXGB2")).toBe(false);
    expect(normaliseBic("hlfxgb21")).toBe("HLFXGB21XXX");
    expect(normaliseBic("HLFXGB21D70")).toBe("HLFXGB21D70");
  });
});

describe("single requests", () => {
  it("checks the sort code alone when there's no account number", () => {
    expect(sortCodeRequest("42-42-42")).toEqual({
      ok: true,
      request: { kind: "sortcode", path: "/sortcode/424242", input: "42-42-42" },
    });
  });

  it("checks the pair when there is one", () => {
    expect(sortCodeRequest("424242", " 42424242 ")).toMatchObject({
      ok: true,
      request: { kind: "account", path: "/sortcode/424242/account/42424242" },
    });
  });

  it("refuses malformed input without building a path", () => {
    expect(sortCodeRequest("4242")).toMatchObject({ ok: false });
    expect(sortCodeRequest("424242", "12")).toMatchObject({ ok: false });
    expect(ibanRequest("../../admin")).toMatchObject({ ok: false });
    expect(bicRequest("TEST/4242")).toMatchObject({ ok: false });
  });

  it("normalises IBANs and BICs into the path", () => {
    expect(ibanRequest("gb42 sand 4242 4242 4242 42")).toMatchObject({
      request: { kind: "iban", path: "/iban/GB42SAND42424242424242" },
    });
    expect(bicRequest("TEST4242")).toMatchObject({
      request: { kind: "swift", path: "/swift/TEST4242XXX" },
    });
  });
});

describe("bulk lines (TOOL-08)", () => {
  it("reads sort code and account number separated by a comma", () => {
    expect(parseBulkLine("42-42-42, 42424242", "standard")).toMatchObject({
      ok: true,
      request: { kind: "account" },
    });
    expect(parseBulkLine("424242", "standard")).toMatchObject({ ok: false });
    expect(parseBulkLine("424242,", "standard")).toMatchObject({ ok: false });
  });

  it("refuses commas in single-value formats", () => {
    expect(parseBulkLine("424242,1", "sortcode")).toEqual({
      ok: false,
      error: "Expected one sort code per line",
    });
    expect(parseBulkLine("GB42,SAND", "iban")).toMatchObject({ ok: false });
    expect(parseBulkLine("TEST,4242", "bic")).toMatchObject({ ok: false });
  });

  it("reads the other three formats", () => {
    expect(parseBulkLine("424242", "sortcode")).toMatchObject({ request: { kind: "sortcode" } });
    expect(parseBulkLine("GB42SAND42424242424242", "iban")).toMatchObject({
      request: { kind: "iban" },
    });
    expect(parseBulkLine("TEST4242XXX", "bic")).toMatchObject({ request: { kind: "swift" } });
  });

  it("splits text into non-blank trimmed lines", () => {
    expect(splitBulkInput(" a \r\n\n b\n  \n")).toEqual(["a", "b"]);
  });
});
