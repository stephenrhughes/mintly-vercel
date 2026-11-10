// A stand-in for the Bank Account Checker API, used outside production when
// there is no real key to call it with: local development and CI with the
// fake API Gateway (AWS_ROLE_ARN unset), or sandbox mode without
// SANDBOX_API_KEY. It answers like the sandbox: the published test values
// are valid and everything else is not found. Sort code 99-99-99 answers
// 429, to try the rate-limit messages (TOOL-12).

import type { ApiResponse, BankTransport } from "./transport";

const branch = {
  Info: {
    SortCode: "424242",
    ShortOwningBank: "MINTLY TEST BANK",
    ShortBranchTitle: "SANDBOX BRANCH",
    BranchName: "SANDBOX",
    BicField1: "TEST4242",
    BicField2: "XXX",
  },
  Address: {
    BranchAddressPart1: "1 Test Street",
    BranchTown: "London",
    BranchPostCode1: "EC1A",
    BranchPostCode2: "1AA",
    BranchTelephoneArea: "020",
    BranchTelephone: "7946 0000",
  },
  PaymentTypes: {
    DirectDebitAccepted: true,
    DirectCreditAccepted: true,
    DirectDebitInstructionsAccepted: true,
    AuddisAccepted: true,
    BacsAccepted: true,
    ChapsAccepted: true,
    IcsAccepted: true,
    FasterPaymentAccepted: true,
    SepaMember: false,
    SepaDirectDebit: false,
  },
};

const IBAN = "GB42SAND42424242424242";

const ok = (body: unknown): ApiResponse => ({ status: 200, body });
const notFound = (message = "Not found"): ApiResponse => ({
  status: 404,
  body: { Status: "Invalid", Message: message },
});

export function fakeBankResponse(path: string): ApiResponse {
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const [resource, value, sub, account] = parts;

  if (resource === "sortcode") {
    if (value === "999999") {
      return { status: 429, body: { message: "Limit Exceeded" } };
    }
    if (value !== "424242") return notFound("Sort code not found");
    if (sub === "account") {
      return account === "42424242"
        ? ok({
            Status: "Valid",
            DerivedIban: IBAN,
            ModulusCheckCompleted: true,
            BranchData: branch,
          })
        : notFound("Account number is not valid for this sort code");
    }
    return ok({ Status: "Valid", BranchData: branch });
  }
  if (resource === "iban") {
    return value === IBAN
      ? ok({ Status: "Valid", DerivedIban: IBAN, BranchData: branch })
      : notFound();
  }
  if (resource === "swift") {
    return value === "TEST4242XXX" ? ok({ Status: "Valid", BranchData: branch }) : notFound();
  }
  return { status: 400, body: { Message: "Unknown request" } };
}

export function createFakeTransport(): BankTransport {
  return async (path) => fakeBankResponse(path);
}
