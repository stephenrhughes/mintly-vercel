import {
  BadgePoundSterling,
  Code2,
  Gauge,
  Infinity as InfinityIcon,
  LayoutDashboard,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { CheckList } from "@/components/site/check-list";
import { ComparisonTable } from "@/components/site/comparison-table";
import { CtaBand } from "@/components/site/cta-band";
import { FeatureGrid } from "@/components/site/feature-grid";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { VideoEmbed } from "@/components/site/video-embed";
import { Button } from "@/components/ui/button";
import { fullJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/features");

const stats = [
  { value: "20,000+", label: "UK Branches" },
  { value: "99.95%", label: "Uptime" },
  { value: "<50ms", label: "Mean Response" },
  { value: "Weekly", label: "Updates" },
];

const reasons = [
  {
    icon: Gauge,
    title: "Lightning Fast",
    text: "Average response time under 50ms. Get validation results in real-time without slowing down your workflow.",
  },
  {
    icon: Target,
    title: "Always Accurate",
    text: "Weekly data updates from UK banks and BACS. 100% coverage of all UK and Irish sort codes - over 20,000 branches.",
  },
  {
    icon: InfinityIcon,
    title: "Infinitely Scalable",
    text: "Cloud-native infrastructure with no request limits. Process one validation or one million - same reliable performance.",
  },
  {
    icon: BadgePoundSterling,
    title: "Best Value in the UK",
    text: "Enterprise plans from 0.44p per check. No hidden fees. Get started in minutes.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    text: "Multi-user access included. Share one subscription across your entire team with role-based permissions.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Compliant",
    text: "End-to-end encryption, GDPR compliant, Cyber Essentials certified. We never store the bank account data you send.",
  },
];

const comparison = [
  { feature: "UK & Ireland bank account validation", values: [true, true] },
  { feature: "Global IBAN validation", values: [true, true] },
  {
    feature: "National check digit validation",
    note: "Advanced validation beyond basic IBAN checks",
    values: [true, false],
  },
  {
    feature: "Team collaboration & multi-user access",
    note: "Share one subscription across your team",
    values: [true, false],
  },
  {
    feature: "Sub-50ms response times",
    note: "Industry-leading performance",
    values: [true, false],
  },
  {
    feature: "99.95% uptime SLA",
    note: "Enterprise-grade reliability for Enterprise Plans",
    values: [true, false],
  },
  {
    feature: "14-day free trial",
    note: "Full feature access, no credit card required",
    values: [true, false],
  },
  {
    feature: "Usage based billing",
    note: "Smart billing you based on your usage. No credits to top up.",
    values: [true, false],
  },
  {
    feature: "Free checks with every plan",
    note: "A free tier so you can pick a plan that suits your needs.",
    values: [true, false],
  },
  {
    feature: "OpenAPI 3.0 compliant RESTful API",
    note: "Modern API standards for easy integration",
    values: [true, false],
  },
  {
    feature: "Dedicated UK support team",
    note: "We can help you get started at no extra cost",
    values: [true, false],
  },
];

const strong = (label: string, rest: string) => (
  <>
    <strong>{label}</strong> - {rest}
  </>
);

export default function FeaturesPage() {
  return (
    <>
      <JsonLd data={fullJsonLd(pageInfo("/features", "Mintly Features", "2022-10-05"))} />
      <PageHero
        title="Everything You Need to Validate Bank Accounts"
        lead="From powerful APIs for developers to easy web tools for teams - eliminate payment errors with the UK's most comprehensive bank validation platform."
        actions={
          <>
            <Button
              asChild
              size="lg"
              className="bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
            >
              <Link href="/pricing">Start Free Trial</Link>
            </Button>
            <BookDemoButton size="lg" variant="onDark" />
          </>
        }
      >
        <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
              <dd className="text-2xl font-semibold">{stat.value}</dd>
              <dt className="mt-1 text-xs text-white/70">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </PageHero>

      <Section>
        <SectionHeading
          align="center"
          title="Choose Your Solution"
          lead="Whether you need API integration or easy web tools, we've got you covered"
        />
        <FeatureGrid
          columns={2}
          features={[
            {
              icon: Code2,
              title: <a href="#api">Developer API</a>,
              text: "RESTful API with OpenAPI 3.0 spec. Integrate validation directly into your applications, payment systems, or customer portals.",
              tags: ["Unlimited requests", "OpenAPI 3.0", "Multi-language guides"],
            },
            {
              icon: LayoutDashboard,
              title: <a href="#web-tools">Web Tools</a>,
              text: "Secure online portal for manual validation. Perfect for finance teams, accountants, and businesses without developers.",
              tags: ["Bulk CSV upload", "Team collaboration", "No coding required"],
            },
          ]}
        />
      </Section>

      <Section tone="muted">
        <SectionHeading
          align="center"
          title="Why Choose Mintly?"
          lead="The most comprehensive bank validation platform for UK businesses"
        />
        <FeatureGrid features={reasons} />
      </Section>

      <Section>
        <SectionHeading
          align="center"
          title="How We Compare"
          lead="See why businesses choose Mintly over competitors"
        />
        <ComparisonTable columns={["Mintly", "Competitors"]} rows={comparison} />
        <div className="mt-8 text-center">
          <Button asChild>
            <Link href="/pricing">View Pricing &amp; Start Free Trial</Link>
          </Button>
        </div>
      </Section>

      <Section id="api" tone="muted">
        <SectionHeading
          align="center"
          title="Developer API Features"
          lead="RESTful API built for modern development teams"
        />
        <div className="mt-10 rounded-xl border bg-card p-6 shadow-xs sm:p-8">
          <h3 className="text-xl font-semibold">Powerful Integration, Simple Implementation</h3>
          <div className="mt-3 space-y-3 text-muted-foreground">
            <p>
              Our OpenAPI 3.0 compliant REST API makes integration seamless. Send a single GET
              request with bank account details and receive comprehensive validation results,
              including branch data and supported payment types (BACS, CHAPS, Faster Payments,
              SEPA).
            </p>
            <p>
              Perfect for automating{" "}
              <Link href="/articles/auddis" className="text-primary underline">
                AUDDIS submissions
              </Link>
              ,{" "}
              <Link href="/articles/bacs-and-direct-debit" className="text-primary underline">
                BACS and Direct Debit checks
              </Link>
              , or validating customer payment details in your web portal. Connect from{" "}
              <Link
                href="/integration-guides/salesforce-integration"
                className="text-primary underline"
              >
                Salesforce
              </Link>
              , Node.js, Python, PHP, or any language that supports HTTP.
            </p>
          </div>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <h4 className="font-semibold">Core API Features</h4>
              <CheckList
                className="mt-3 text-sm"
                items={[
                  strong("100% UK & Ireland coverage", "All active bank branches"),
                  strong("99.95% uptime", "Enterprise reliability"),
                  strong("Sub-50ms response", "Lightning fast validation"),
                  strong("Unlimited requests", "No limits on paid plans"),
                  strong("Scale to millions", "Infrastructure for business"),
                  strong("OpenAPI 3.0 spec", "Auto-generate client code"),
                ]}
              />
            </div>
            <div>
              <h4 className="font-semibold">What You Get</h4>
              <CheckList
                className="mt-3 text-sm"
                items={[
                  strong("Full branch data", "Address, phone, bank name"),
                  strong("Payment types", "BACS, CHAPS, Faster Payments, Direct Debits, AUDDIS"),
                  strong("IBAN generation", "Convert UK accounts to IBAN"),
                  strong("Usage analytics", "Track API calls"),
                  strong("Onboarding support", "We can help with integration"),
                ]}
              />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/bank-account-validation-api">Read more about our API</Link>
            </Button>
            <Button asChild>
              <Link href="/pricing">Start Free Trial</Link>
            </Button>
          </div>
        </div>
        <FeatureGrid
          columns={2}
          features={[
            {
              title: "Bank Account & IBAN Validation",
              text: "Validate sort code + account number combinations. Returns IBAN, branch details, and supported payment methods. Works for all UK and Irish accounts.",
            },
            {
              title: "Sort Code Lookup",
              text: "Validate sort codes and SWIFT/BIC codes. Returns complete branch information including address, telephone, and accepted payment types.",
            },
          ]}
        />
      </Section>

      <Section id="web-tools">
        <SectionHeading
          align="center"
          title="Web Tools Features"
          lead="Secure online portal for teams - no coding required"
        />
        <div className="mt-10 rounded-xl border bg-card p-6 shadow-xs sm:p-8">
          <h3 className="text-xl font-semibold">Easy Validation for Non-Technical Teams</h3>
          <div className="mt-3 space-y-3 text-muted-foreground">
            <p>
              No development team? No problem. Access our powerful validation tools through a secure
              web interface.{" "}
              <Link href="/pricing" className="text-primary underline">
                Start your 14-day free trial
              </Link>{" "}
              to validate sort codes, account numbers, IBANs, and SWIFT codes instantly.
            </p>
            <p>
              Validate accounts one at a time or upload CSV files for bulk processing. Download
              detailed reports with validation results. Perfect for finance teams, accountants, and
              administrative staff.
            </p>
          </div>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <h4 className="font-semibold">Web Portal Features</h4>
              <CheckList
                className="mt-3 text-sm"
                items={[
                  strong("Single & bulk validation", "CSV upload/download"),
                  strong("Team collaboration", "Multi-user access included"),
                  strong("Global IBAN support", "Validate 89 countries"),
                  strong("Instant results", "Same fast backend as API"),
                  strong("Secure access", "End-to-end encryption"),
                ]}
              />
            </div>
            <div>
              <h4 className="font-semibold">Perfect For</h4>
              <CheckList
                className="mt-3 text-sm"
                items={[
                  strong("Finance teams", "Validate payroll & supplier details"),
                  strong("Accountants", "Check client bank details"),
                  strong("Property managers", "Validate tenant accounts"),
                  strong("Admin staff", "Process refunds & payments"),
                  strong("Small businesses", "No developers needed"),
                ]}
              />
            </div>
          </div>
          <div id="help" className="mt-8 scroll-mt-24">
            <VideoEmbed id="ksC-T3O11RY" title="Mintly Toolset Demo" />
          </div>
          <div className="mt-8 text-center">
            <Button asChild size="lg">
              <Link href="/pricing">Start 14-Day Free Trial</Link>
            </Button>
          </div>
        </div>
        <FeatureGrid
          columns={2}
          features={[
            {
              title: "Bank Account Validation",
              text: "Enter sort code and account number to instantly validate and get branch details, IBAN, and supported payment types.",
            },
            {
              title: "Bulk CSV Processing",
              text: "Upload spreadsheets with hundreds or thousands of accounts. Download validation reports in seconds.",
            },
          ]}
        />
      </Section>

      <CtaBand
        title="Ready to Eliminate Payment Errors?"
        lead={
          <>
            Join the businesses using Mintly to validate bank accounts. Start your 14-day free trial
            today - no credit card required.
            <span className="mt-3 block text-sm text-white/60">
              14-day trial • Full feature access • No credit card • Cancel anytime
            </span>
          </>
        }
      />
    </>
  );
}
