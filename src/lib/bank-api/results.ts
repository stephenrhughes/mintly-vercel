// Reading the API's answers for display and download (TOOL-06, TOOL-10,
// TOOL-11). Safe for the browser: no keys, no server code.

import type { CheckResult } from "./run";

type Info = {
  SortCode?: string;
  sortCode?: string;
  ShortOwningBank?: string;
  ShortBranchTitle?: string;
  BranchName?: string;
  BicField1?: string;
  BicField2?: string;
};

export type AccountBody = {
  Status?: string;
  Message?: string;
  message?: string;
  DerivedIban?: string;
  ModulusCheckCompleted?: boolean;
  BranchData?: {
    Info?: Info;
    Address?: Record<string, string | undefined>;
    PaymentTypes?: Record<string, boolean | undefined>;
  };
};

export function asAccountBody(body: unknown): AccountBody {
  return body && typeof body === "object" ? (body as AccountBody) : {};
}

const bicPart = (value: string | undefined) => (value && value !== "NULL" ? value : "");

/** The facts worth a column or a line: bank, branch, sort code, IBAN, BIC. */
export function summarise(body: unknown) {
  const account = asAccountBody(body);
  const info = account.BranchData?.Info ?? {};
  return {
    bank: info.ShortOwningBank ?? "",
    branch: info.ShortBranchTitle ?? info.BranchName ?? "",
    sortCode: info.SortCode ?? info.sortCode ?? "",
    iban: account.DerivedIban ?? "",
    bic: `${bicPart(info.BicField1)}${bicPart(info.BicField2)}`,
    message: account.Message ?? account.message ?? "",
  };
}

export const outcomeLabels: Record<CheckResult["outcome"], string> = {
  valid: "Valid",
  invalid: "Invalid",
  rate_limited: "Too many requests",
  error: "Error",
  malformed: "Not checked: wrong format",
  not_sent: "Not sent",
};

/** The line under each bulk result (TOOL-10). */
export function resultMessage(result: CheckResult): string {
  switch (result.outcome) {
    case "valid": {
      const s = summarise(result.body);
      return [s.bank, s.iban || s.sortCode || s.bic].filter(Boolean).join(" · ");
    }
    case "invalid":
      return summarise(result.body).message || "Not a valid account";
    case "rate_limited":
      return "Daily trial limit or request rate limit reached. Please try again later.";
    case "not_sent":
      return "Stopped after the request limit was reached.";
    case "malformed":
      return result.message ?? "Wrong format";
    case "error":
      return summarise(result.body).message || "Something went wrong with this check.";
  }
}

// A cell can't start a spreadsheet formula (CSV injection).
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export const CSV_COLUMNS = [
  "status",
  "input",
  "bank",
  "branch",
  "sort_code",
  "iban",
  "bic",
  "message",
] as const;

/** Bulk results as CSV, for paid plans (TOOL-11). */
export function resultsToCsv(results: CheckResult[]): string {
  const rows = results.map((result) => {
    const s = summarise(result.body);
    const message = result.outcome === "valid" ? "" : resultMessage(result);
    return [
      outcomeLabels[result.outcome].toUpperCase(),
      result.input,
      s.bank,
      s.branch,
      s.sortCode,
      s.iban,
      s.bic,
      message,
    ]
      .map(cell)
      .join(",");
  });
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}
