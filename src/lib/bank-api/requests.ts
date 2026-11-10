// Turning what someone types on the Tools page into Bank Account Checker API
// requests (TOOL-03 to TOOL-05, TOOL-08), ported from mintly-web
// src/components/Tools.js. Used by the browser to check as you type and by
// the server, which checks everything again before calling the API.

export type CheckKind = "sortcode" | "account" | "iban" | "swift";

/** The four bulk input formats (TOOL-08). */
export const BULK_DATA_TYPES = ["standard", "sortcode", "iban", "bic"] as const;
export type BulkDataType = (typeof BULK_DATA_TYPES)[number];

export const bulkDataTypeLabels: Record<BulkDataType, string> = {
  standard: "Sort code and account number",
  sortcode: "Sort code only",
  iban: "IBAN",
  bic: "BIC",
};

/** Lines per request to /api/check/batch (plan §6.2). */
export const BATCH_SIZE = 25;
/** Largest file the bulk check accepts (TOOL-08). */
export const MAX_BULK_FILE_BYTES = 1000 * 1024;

/** A request ready to send: the API path and the kind of check, for the log. */
export type CheckRequest = { kind: CheckKind; path: string; input: string };

export type Parsed = { ok: true; request: CheckRequest } | { ok: false; error: string };

const SORT_CODE = /^[0-9]{6}$|^[0-9]{2}-[0-9]{2}-[0-9]{2}$/;
const ACCOUNT_NUMBER = /^[0-9]{6,10}$/;
const IBAN = /^[a-zA-Z]{2}[0-9]{2}[a-zA-Z0-9]{4}[0-9]{5,30}$/;
const BIC = /^[a-zA-Z0-9]{8}([a-zA-Z0-9]{3})?$/;

export function isValidSortCode(value: string): boolean {
  return SORT_CODE.test(value.trim());
}

/** The account number is optional: blank means a sort code check (TOOL-03). */
export function isValidAccountNumber(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || ACCOUNT_NUMBER.test(trimmed);
}

/** IBANs may be typed with spaces (TOOL-04). */
export function normaliseIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function isValidIban(value: string): boolean {
  return IBAN.test(normaliseIban(value));
}

/** BICs may have spaces; 8-character codes are padded with X to 11 (TOOL-05). */
export function normaliseBic(value: string): string {
  const bic = value.replace(/\s+/g, "").toUpperCase();
  return bic.length === 8 ? `${bic}XXX` : bic;
}

export function isValidBic(value: string): boolean {
  return BIC.test(value.replace(/\s+/g, ""));
}

const digits = (value: string) => value.replace(/\D/g, "");
const segment = (value: string) => encodeURIComponent(value);

export function sortCodeRequest(sortCode: string, accountNumber = ""): Parsed {
  if (!isValidSortCode(sortCode)) {
    return { ok: false, error: "Enter a 6-digit sort code, such as 12-34-56" };
  }
  if (!isValidAccountNumber(accountNumber)) {
    return { ok: false, error: "An account number has 6 to 10 digits" };
  }
  const code = digits(sortCode);
  const account = accountNumber.trim();
  if (!account) {
    return {
      ok: true,
      request: { kind: "sortcode", path: `/sortcode/${segment(code)}`, input: sortCode.trim() },
    };
  }
  return {
    ok: true,
    request: {
      kind: "account",
      path: `/sortcode/${segment(code)}/account/${segment(account)}`,
      input: `${sortCode.trim()},${account}`,
    },
  };
}

export function ibanRequest(iban: string): Parsed {
  if (!isValidIban(iban))
    return { ok: false, error: "Enter an IBAN, such as GB33 BUKB 2020 1555 5555 55" };
  const value = normaliseIban(iban);
  return {
    ok: true,
    request: { kind: "iban", path: `/iban/${segment(value)}`, input: iban.trim() },
  };
}

export function bicRequest(bic: string): Parsed {
  if (!isValidBic(bic))
    return { ok: false, error: "A SWIFT/BIC code has 8 or 11 letters and numbers" };
  const value = normaliseBic(bic);
  return {
    ok: true,
    request: { kind: "swift", path: `/swift/${segment(value)}`, input: bic.trim() },
  };
}

/** One line of a bulk check (TOOL-08). Malformed lines are reported, not sent. */
export function parseBulkLine(line: string, dataType: BulkDataType): Parsed {
  const value = line.trim();
  if (dataType === "standard") {
    const parts = value.split(",");
    if (parts.length !== 2 || !parts[1].trim()) {
      return { ok: false, error: "Expected a sort code and account number, separated by a comma" };
    }
    return sortCodeRequest(parts[0], parts[1]);
  }
  if (value.includes(",")) {
    const name = { sortcode: "sort code", iban: "IBAN", bic: "BIC" }[dataType];
    return { ok: false, error: `Expected one ${name} per line` };
  }
  if (dataType === "sortcode") return sortCodeRequest(value);
  if (dataType === "iban") return ibanRequest(value);
  return bicRequest(value);
}

/** The non-blank lines of pasted or uploaded text. */
export function splitBulkInput(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function isBulkDataType(value: unknown): value is BulkDataType {
  return typeof value === "string" && (BULK_DATA_TYPES as readonly string[]).includes(value);
}

/** The published sandbox test values (APPR-03), from the API's own guide. */
export const SANDBOX_TEST_VALUES = {
  sortCode: "42-42-42",
  accountNumber: "42424242",
  iban: "GB42 SAND 4242 4242 4242 42",
  bic: "TEST4242XXX",
} as const;
