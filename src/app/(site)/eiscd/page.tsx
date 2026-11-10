import { BadgeCheck, CalendarClock, Cloud, Database, FileStack, GitCompare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { CheckList } from "@/components/site/check-list";
import { ComparisonTable } from "@/components/site/comparison-table";
import { EiscdProduct } from "@/components/site/eiscd-product";
import { Enquiry } from "@/components/site/enquiry/enquiry";
import { FeatureGrid } from "@/components/site/feature-grid";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { eiscdJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/eiscd");

const link = (href: string, text: string) => (
  <Link href={href} className="text-primary underline underline-offset-2">
    {text}
  </Link>
);

export default function EiscdPage() {
  return (
    <>
      <JsonLd data={eiscdJsonLd(pageInfo("/eiscd", "EISCD Features", "2024-09-16"))} />
      <PageHero
        title="EISCD Data File - Complete UK Sort Code Directory"
        lead="Access over 20,000 UK sort codes with complete bank details. Download or integrate via API with weekly updates. Official authorized distributor."
        actions={
          <>
            <BookDemoButton
              meeting="eiscd"
              size="lg"
              variant="default"
              className="bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
            />
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/eiscd-api">Explore the EISCD API</Link>
            </Button>
          </>
        }
      >
        <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["20,000+", "Sort Codes"],
            ["Weekly", "Updates"],
            ["4", "File Formats"],
            ["100%", "UK Coverage"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
              <dd className="text-2xl font-semibold">{value}</dd>
              <dt className="mt-1 text-xs text-white/70">{label}</dt>
            </div>
          ))}
        </dl>
      </PageHero>

      <Section narrow>
        <SectionHeading
          title="What is the EISCD?"
          lead="The Extended Industry Sort Code Directory is the definitive UK bank branch reference database"
        />
        <div className="mt-6 space-y-4 text-muted-foreground">
          <p>
            The{" "}
            <strong className="text-foreground">
              EISCD (Extended Industry Sort Code Directory)
            </strong>{" "}
            is the authoritative database of all UK sort codes with complete bank branch
            information. It&apos;s the standard reference used by financial institutions, payment
            processors, and businesses across the UK.
          </p>
          <p>
            Each entry includes sort code, bank name, branch name, full address, BIC/SWIFT code,
            contact details, and supported payment types (BACS, CHAPS, Faster Payments). Updated
            weekly to reflect new branches, closures, and changes.
          </p>
        </div>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/articles/eiscd-data-file">Learn More About EISCD</Link>
        </Button>
      </Section>

      <Section tone="navy">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Need to get the EISCD via API?</h2>
          <p className="mt-4 text-lg text-white/80">
            Pull the EISCD straight into your systems with our dedicated REST API - full base file
            or weekly deltas, in TXT, CSV, XML or XLSX.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
          >
            <Link href="/eiscd-api">Explore the EISCD API</Link>
          </Button>
        </div>
      </Section>

      <Section>
        <SectionHeading
          align="center"
          title="Why Choose Mintly for Your EISCD Data?"
          lead="Authorized distributor with reliable delivery and flexible access options"
        />
        <FeatureGrid
          features={[
            {
              icon: BadgeCheck,
              title: "Authorized Distributor",
              text: "Official EISCD authorized distributor. Get legitimate, trustworthy data directly from a recognized source.",
            },
            {
              icon: CalendarClock,
              title: "Weekly Updates",
              text: "Updated every week with new branches, closures, and changes. Stay current with the latest UK banking landscape.",
            },
            {
              icon: FileStack,
              title: "Multiple Formats",
              text: "Available in CSV, XML, XLSX, and TXT formats. Choose the format that works best for your systems.",
            },
            {
              icon: Cloud,
              title: "API Access",
              text: "OpenAPI 3.0 compliant REST API for programmatic access. Download full datasets or weekly changes.",
            },
            {
              icon: GitCompare,
              title: "Computed Deltas",
              text: "We work out what's changed each week, so you can pull the changes and keep your data in sync.",
            },
            {
              icon: Database,
              title: "Complete Coverage",
              text: "100% coverage of all active UK sort codes. Over 20,000 entries including all banks and building societies.",
            },
          ]}
        />
      </Section>

      <Section tone="muted">
        <SectionHeading
          align="center"
          title="EISCD vs Manual Maintenance"
          lead="Why maintaining your own sort code database doesn't make sense"
        />
        <ComparisonTable
          columns={["Mintly EISCD", "Manual Database"]}
          rows={[
            {
              feature: "Data completeness",
              values: [
                { ok: true, text: "20,000+ sort codes" },
                { ok: false, text: "Varies, often incomplete" },
              ],
            },
            {
              feature: "Update frequency",
              note: "How often is data refreshed?",
              values: [
                { ok: true, text: "Weekly automated" },
                { ok: false, text: "Manual, infrequent" },
              ],
            },
            {
              feature: "Staff time required",
              note: "Hours per week maintaining data",
              values: [
                { ok: true, text: "Zero - fully automated" },
                { ok: false, text: "10-20 hours/week" },
              ],
            },
            {
              feature: "Data accuracy",
              values: [{ ok: true, text: "Official source" }, "Prone to errors"],
            },
            {
              feature: "API access",
              note: "Programmatic integration",
              values: [true, "Needs IT/Development support"],
            },
            {
              feature: "Multiple file formats",
              note: "CSV, XML, XLSX, TXT",
              values: [true, "Limited formats"],
            },
            { feature: "Includes BIC/SWIFT codes", values: [true, "Often missing"] },
            {
              feature: "Support & documentation",
              values: [{ ok: true, text: "Full UK support" }, "No support"],
            },
          ]}
        />
      </Section>

      <Section>
        <SectionHeading
          align="center"
          title="What's Included in the EISCD"
          lead="Comprehensive data for every UK sort code"
        />
        <div className="mt-10 rounded-xl border bg-card p-6 shadow-xs sm:p-8">
          <h3 className="text-xl font-semibold">Complete Bank Branch Information</h3>
          <p className="mt-3 text-muted-foreground">
            Each EISCD entry contains detailed information about UK bank branches. Use it for sort
            code lookup, bank name identification, address verification, and payment routing.
            Perfect for financial software, payment systems, and business applications.
          </p>
          <p className="mt-3 text-muted-foreground">
            Need account number validation too? Our {link("/features", "Bank Account Checker API")}{" "}
            combines EISCD data with modulus checking to validate complete bank account details.
          </p>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <h4 className="font-semibold">Data Fields Included</h4>
              <CheckList
                className="mt-3 text-sm"
                items={[
                  <>
                    <strong>Sort code</strong> - 6-digit bank branch identifier
                  </>,
                  <>
                    <strong>Bank name</strong> - Full legal name of the bank
                  </>,
                  <>
                    <strong>Branch name</strong> - Specific branch identifier
                  </>,
                  <>
                    <strong>Full address</strong> - Complete postal address
                  </>,
                  <>
                    <strong>BIC/SWIFT code</strong> - International bank identifier
                  </>,
                ]}
              />
            </div>
            <div>
              <h4 className="font-semibold">Additional Information</h4>
              <CheckList
                className="mt-3 text-sm"
                items={[
                  <>
                    <strong>Contact details</strong> - Phone, fax where available
                  </>,
                  <>
                    <strong>Payment types</strong> - BACS, CHAPS, Faster Payments, DD
                  </>,
                  <>
                    <strong>Status flags</strong> - Active, closed, redirected branches
                  </>,
                  <>
                    <strong>Change tracking</strong> - Weekly delta files available
                  </>,
                  <>
                    <strong>Historical data</strong> - Track changes over time
                  </>,
                ]}
              />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/eiscd-docs">View API Documentation</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/articles/eiscd-data-file">Learn More About EISCD</Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section id="pricing" tone="mint">
        <SectionHeading
          align="center"
          title="EISCD Pricing"
          lead="Simple licensing for organizations of any size"
        />
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_1fr]">
          <EiscdProduct />
          <div className="rounded-xl border bg-card p-6 text-sm shadow-xs">
            <h3 className="font-semibold">Important Licensing Information</h3>
            <p className="mt-3 text-muted-foreground">
              EISCD licensing allows use throughout your entire organization. The whole organization
              must access the same original copy - redistribution to separate entities is not
              permitted. See our {link("/eiscd-terms", "EISCD Terms & Conditions")} for full
              details.
            </p>
            <p className="mt-3 text-muted-foreground">
              <strong className="text-foreground">Need help choosing?</strong> Contact our team for
              guidance on which access method and licensing option is right for your use case.
            </p>
          </div>
        </div>
      </Section>

      <section className="bg-brand-navy text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Ready to Access the Complete UK Sort Code Directory?
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Get started with EISCD today. Integrate via API and get weekly updates to ensure you
            always have current data.
          </p>
          <div className="mt-8 flex justify-center">
            <BookDemoButton
              meeting="eiscd"
              size="lg"
              variant="default"
              className="bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
            />
          </div>
          <p className="mt-4 text-sm text-white/60">
            Authorized distributor • Weekly updates • Multiple formats • API access
          </p>
        </div>
      </section>

      <Section id="contact" tone="muted">
        <Enquiry product="eiscd" />
      </Section>
    </>
  );
}
