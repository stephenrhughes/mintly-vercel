import { CircleAlert, CircleCheck } from "lucide-react";

import { asAccountBody } from "@/lib/bank-api/results";
import { cn } from "@/lib/utils";

// One check's answer (TOOL-06), ported from mintly-web AccountResult.js:
// valid or invalid, the derived IBAN, branch details and payment types.

const paymentTypes: Array<[string[], string, string?]> = [
  [["DirectDebitAccepted"], "Direct Debit payments"],
  [["DirectCreditAccepted"], "Direct Credit payments"],
  [["DirectDebitInstructionsAccepted"], "Direct Debit Instructions"],
  [["AuddisAccepted"], "AUDDIS", "Automated Direct Debit Instruction Service"],
  [["FasterPaymentAccepted", "FasterPaymentsAccepted"], "Faster Payments"],
  [["BacsAccepted"], "BACS payments", "Bankers' Automated Clearing System"],
  [["ChapsAccepted"], "CHAPS payments"],
  [["IcsAccepted"], "ICS payments", "Image Clearing System, for digital cheques"],
  [["SepaMember"], "SEPA member", "Single Euro Payments Area"],
  [["SepaDirectDebit"], "SEPA Direct Debit Core"],
];

function Row({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 border-b py-2 text-sm last:border-b-0">
      <dt className="text-muted-foreground">
        {title ? (
          <abbr title={title} className="no-underline">
            {label}
          </abbr>
        ) : (
          label
        )}
      </dt>
      <dd className="min-w-0 break-words">{value || "—"}</dd>
    </div>
  );
}

export function AccountResult({ body, valid }: { body: unknown; valid: boolean }) {
  const account = asAccountBody(body);
  const branch = account.BranchData;
  const info = branch?.Info ?? {};
  const address = branch?.Address ?? {};
  const types = branch?.PaymentTypes ?? {};
  const bic = [info.BicField1, info.BicField2].filter((part) => part && part !== "NULL").join(" ");
  const addressLine = [
    address.BranchAddressPart1,
    address.BranchAddressPart2,
    address.BranchAddressPart3,
    address.BranchAddressPart4,
    address.BranchTown,
    address.BranchCounty,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid gap-4">
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border px-4 py-3",
          valid ? "border-primary/30 bg-secondary" : "border-destructive/30 bg-destructive/5",
        )}
      >
        {valid ? (
          <CircleCheck className="mt-0.5 size-5 text-primary" aria-hidden />
        ) : (
          <CircleAlert className="mt-0.5 size-5 text-destructive" aria-hidden />
        )}
        <div>
          <p className="text-lg font-semibold tracking-tight">{valid ? "Valid" : "Invalid"}</p>
          {!valid ? (
            <p className="text-sm text-muted-foreground">
              {account.Message ?? account.message ?? "These details aren't valid."}
            </p>
          ) : null}
          {account.DerivedIban ? (
            <p className="text-sm">
              <span className="text-muted-foreground">IBAN </span>
              <span className="font-mono">{account.DerivedIban}</span>
            </p>
          ) : null}
        </div>
      </div>

      {branch && Object.keys(branch).length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          <section aria-label="Branch details">
            <h3 className="mb-1 text-sm font-semibold">Branch</h3>
            <dl>
              <Row label="Bank" value={info.ShortOwningBank} />
              <Row label="Branch" value={info.ShortBranchTitle ?? info.BranchName} />
              <Row label="Sort code" value={info.SortCode ?? info.sortCode} />
              <Row label="Address" value={addressLine} />
              <Row
                label="Postcode"
                value={[address.BranchPostCode1, address.BranchPostCode2].filter(Boolean).join(" ")}
              />
              <Row
                label="Telephone"
                value={[address.BranchTelephoneArea, address.BranchTelephone]
                  .filter(Boolean)
                  .join(" ")}
              />
              <Row label="BIC" value={bic} title="Business Identifier Code (SWIFT code)" />
            </dl>
          </section>
          <section aria-label="Supported payment types">
            <h3 className="mb-1 text-sm font-semibold">Supported payment types</h3>
            <dl>
              {paymentTypes.map(([keys, label, title]) => (
                <Row
                  key={label}
                  label={label}
                  title={title}
                  value={keys.some((key) => types[key]) ? "Yes" : "No"}
                />
              ))}
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}
