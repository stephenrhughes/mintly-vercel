import Link from "next/link";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { CheckList } from "@/components/site/check-list";
import { Button } from "@/components/ui/button";
import { EISCD_PLAN } from "@/lib/billing/plans";
import { money } from "@/lib/billing/format";

// The EISCD licence card (ported from EiscdProduct.js). The weekly figure is
// derived from the annual price so the card and calculator always agree.
const weekly = EISCD_PLAN.annualPriceGbp / 52;

export function EiscdProduct({ showLinkToFeatures = false }: { showLinkToFeatures?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-semibold">EISCD Data File</h2>
      <p className="mt-2 text-lg">
        From <span className="text-3xl font-semibold">{money(weekly * 100)}</span> /week (paid
        annually)
      </p>
      <p className="mt-4 text-muted-foreground">
        Licence the Extended Industry Sort Code Directory (EISCD) data file and get weekly updates.
        Ideal if you want to process your own data files and have complete control. The EISCD
        contains sort code data for all UK and Northern Ireland finance institutions.
      </p>
      <p className="mt-3 font-medium">Annual fee: {EISCD_PLAN.annualPrice} + VAT</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Need a single extract of the EISCD or less frequent downloads? Contact us for pricing.
      </p>
      <CheckList
        className="mt-5 text-sm"
        items={[
          "Over 20,000 bank branches with sort codes, address and contact data",
          "Contains payment scheme participation for BACS, Faster Payments, ICS and CHAPS for each sort code.",
          "Updated weekly. Get the whole file, or just the weekly changes.",
          "Secure download via API.",
          "Available in CSV, TXT, XLSX or XML format.",
          "Single site licence allows use at one site or data centre.",
        ]}
      />
      <div className="mt-6 flex flex-wrap gap-3">
        <BookDemoButton meeting="eiscd" variant="default" />
        {showLinkToFeatures && (
          <Button asChild variant="outline">
            <Link href="/eiscd">EISCD Features</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
