import {
  Banknote,
  Building2,
  Calculator,
  Clock,
  FileCheck,
  Home,
  ShieldCheck,
  ShoppingCart,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CheckList } from "@/components/site/check-list";
import { FaqList } from "@/components/site/faq-list";
import { FeatureGrid } from "@/components/site/feature-grid";
import { FreeChecker } from "@/components/site/free-checker/free-checker";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { Testimonials } from "@/components/site/testimonials";
import { Button } from "@/components/ui/button";
import { salesToAppHref } from "@/lib/hosts";
import {
  type FaqItem,
  faqJsonLd,
  FREE_TOOL_RATING_COUNTS,
  freeToolsJsonLd,
  howToCheckBankAccount,
  howToCheckSortCode,
} from "@/lib/marketing/json-ld";
import { pageMetadata } from "@/lib/marketing/metadata";
import { pageInfo, siteRoute } from "@/lib/marketing/routes";

export const metadata: Metadata = pageMetadata({
  ...siteRoute("/sort-code-checker"),
  type: "article",
});

const ratings = Object.entries(FREE_TOOL_RATING_COUNTS);
const ratingCount = ratings.reduce((sum, [, n]) => sum + n, 0);
const ratingAverage = ratings.reduce((sum, [s, n]) => sum + Number(s) * n, 0) / ratingCount;

const faq: FaqItem[] = [
  {
    question: "What is a UK sort code?",
    answer:
      "<p>A UK sort code is a 6-digit number that identifies both the bank and the specific branch where an account is held. The format is typically written as XX-XX-XX (e.g., 20-00-00 for Barclays Bank). Sort codes are essential for domestic UK payments including BACS, CHAPS, and Faster Payments.</p>",
  },
  {
    question: "How does sort code validation work?",
    answer:
      "<p>Sort code validation uses modulus checking algorithms defined by BACS (Banks Automated Clearing System). These algorithms verify that the combination of sort code and account number is mathematically valid according to UK banking standards. Mintly's checker uses the latest BACS validation rules, updated weekly.</p>",
  },
  {
    question: "Is Mintly's sort code checker free?",
    answer:
      "<p>Yes! You can use our sort code checker for free with up to 10 validations per week. For unlimited checks, team collaboration, and API access, view our pricing plans starting from £37/month with a 14-day free trial.</p>",
  },
  {
    question: "What information does a sort code reveal?",
    answer:
      "<p>A UK sort code reveals the bank name, branch name, branch address, and supported payment types (BACS, CHAPS, Faster Payments, Direct Debit). Mintly's validator provides all this information instantly, helping you verify payment details are correct.</p>",
  },
  {
    question: "What is modulus checking?",
    answer:
      '<p>Modulus checking is a mathematical algorithm used by UK banks to validate that a sort code and account number combination is genuine. Different banks use different modulus algorithms (mod 10, mod 11, double alternate) to verify account numbers. Learn more in our <a href="/articles/modulus-checking">modulus checking guide</a>.</p>',
  },
  {
    question: "How accurate is your sort code data?",
    answer:
      "<p>Our database is updated weekly with the latest information from UK banks and BACS. We maintain 100% coverage of all active UK and Irish sort codes, including newly opened and recently closed branches. Accuracy is critical for payment processing, so we prioritize data freshness.</p>",
  },
  {
    question: "Can I check multiple sort codes at once?",
    answer: `<p>Yes! Our <a href="${salesToAppHref("/tools")}">web portal</a> supports bulk CSV upload for batch validation with a paid plan. Alternatively, integrate our <a href="/docs">API</a> to validate thousands of sort codes programmatically. Paid plans include unlimited validations.</p>`,
  },
  {
    question: "Can I validate Irish sort codes?",
    answer:
      "<p>Yes, Mintly supports both UK and Irish (Republic of Ireland) sort code validation. Our database covers 100% of UK and Irish banks and building societies, with weekly updates to ensure accuracy.</p>",
  },
  {
    question: "What payment types can a UK bank account support?",
    answer:
      "<p>UK bank accounts can support various payment types: BACS (batch payments, 3 working days), Faster Payments (near-instant, up to £1 million), CHAPS (same-day high-value), and Direct Debit (recurring payments). Not all accounts support all types - Mintly's validation shows which payment types each specific account supports.</p>",
  },
  {
    question: "Do I need an account number to check a sort code?",
    answer:
      "<p>No, the account number field is optional. Entering just a sort code confirms the bank and branch it belongs to. Adding an account number runs a full modulus check to confirm the sort code and account number combination is valid for that bank.</p>",
  },
  {
    question: "What happens if I enter an invalid sort code?",
    answer:
      "<p>If a sort code doesn't match an active UK or Irish bank branch, or the account number fails the bank's modulus check, our tool returns an \"Invalid\" result immediately so you can correct the details before processing a payment.</p>",
  },
];

const related = [
  {
    href: "/get-started",
    title: "Getting Started with Mintly",
    text: "Learn how to use our web tools and API for bank validation",
  },
  {
    href: "/articles/modulus-checking",
    title: "What is Modulus Checking?",
    text: "Deep dive into UK banking validation algorithms",
  },
  {
    href: "/articles/bacs-and-direct-debit",
    title: "BACS and Direct Debit Explained",
    text: "Understand UK payment systems and sort code requirements",
  },
  {
    href: "/docs",
    title: "API Documentation",
    text: "Integrate sort code and account validation into your systems",
  },
  {
    href: "/articles/swift-iban",
    title: "SWIFT and IBAN Validation",
    text: "Validate international bank codes and IBANs",
  },
  {
    href: "/articles/reasons",
    title: "Why Validate Bank Account Details?",
    text: "The business case for automated bank validation",
  },
];

function TrialCta() {
  return (
    <div className="mt-10 text-center">
      <Button asChild size="lg">
        <Link href="/pricing">Start 14-Day Free Trial</Link>
      </Button>
      <p className="mt-3 text-sm text-muted-foreground">
        No credit card required • Cancel anytime • Full access during trial
      </p>
    </div>
  );
}

export default function SortCodeCheckerPage() {
  return (
    <>
      <JsonLd
        data={[
          freeToolsJsonLd(pageInfo("/sort-code-checker", "Free Sort Code Checker", "2022-10-05")),
          faqJsonLd("sort-code-checker#faq", faq),
          howToCheckSortCode,
          howToCheckBankAccount,
        ]}
      />
      <PageHero
        crumbs={[{ label: "Sort Code Checker" }]}
        title="Free UK Sort Code Checker - Instant Bank Validation"
        lead="Validate sort codes and bank account numbers in seconds. Get bank details, branch information, and supported payment types for 100% of UK & Irish banks."
      >
        <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
          {[
            ["20M+", "Account Validations"],
            ["1000+", "Businesses helped"],
            ["<50ms", "Response Time"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
              <dd className="text-2xl font-semibold">{value}</dd>
              <dt className="mt-1 text-xs text-white/70">{label}</dt>
            </div>
          ))}
        </dl>
        <ul className="mt-6 flex flex-wrap gap-2 text-sm">
          {["100% UK Coverage", "Weekly Updates", "10 Free Checks each week"].map((badge) => (
            <li key={badge} className="rounded-full bg-white/10 px-3 py-1">
              {badge}
            </li>
          ))}
        </ul>
      </PageHero>

      <Section id="tryIt">
        <SectionHeading
          align="center"
          title="Try Our Free Sort Code Checker Now"
          lead="No registration required - get instant results"
        />
        <div className="mx-auto mt-10 max-w-2xl">
          <FreeChecker />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Rated {ratingAverage.toFixed(1)}/5 from {ratingCount} users
          </p>
        </div>
      </Section>

      <Section tone="muted" narrow>
        <h2 className="text-3xl font-semibold tracking-tight">What is a UK Sort Code?</h2>
        <div className="mt-4 space-y-4 text-lg text-muted-foreground">
          <p>
            A <strong className="text-foreground">UK sort code</strong> is a 6-digit number that
            identifies the bank and branch where an account is held. Written in the format XX-XX-XX
            (for example, 20-00-00 for Barclays Bank), sort codes are essential for all domestic UK
            payments including BACS transfers, CHAPS payments, and Faster Payments.
          </p>
          <p>
            Every UK bank branch has a unique sort code. When combined with an account number, it
            ensures your payment reaches the correct destination. Using our{" "}
            <strong className="text-foreground">sort code lookup tool</strong>, you can instantly
            verify bank details and avoid payment errors.
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading
          align="center"
          title="Why Validate Sort Codes Before Processing Payments?"
        />
        <FeatureGrid
          features={[
            {
              icon: ShieldCheck,
              title: "Prevent Failed Payments",
              text: "Catch invalid sort codes before processing. Reduce bounced payments by up to 90% and avoid costly banking fees.",
            },
            {
              icon: Zap,
              title: "Save Time & Money",
              text: "Automated validation is 100x faster than manual checks. Process thousands of sort codes in seconds via our API.",
            },
            {
              icon: FileCheck,
              title: "Stay BACS Compliant",
              text: "Meet regulatory requirements with modulus checking algorithms. Updated weekly with the latest BACS specifications.",
            },
          ]}
        />
      </Section>

      <Section tone="muted">
        <SectionHeading
          align="center"
          title="Trusted by Businesses Worldwide"
          lead="See what our customers say about Mintly's bank validation services."
        />
        <Testimonials />
        <TrialCta />
      </Section>

      <Section narrow>
        <h2 className="text-3xl font-semibold tracking-tight">
          How Our Sort Code Validation Works
        </h2>
        <div className="mt-4 space-y-4 text-muted-foreground">
          <p>
            Our <strong className="text-foreground">bank code validator</strong> uses advanced
            modulus checking algorithms defined by BACS (Banks Automated Clearing System). Each bank
            uses one of a set of specific algorithms - mod-10, mod-11, or double alternate - along
            with its own weighting table to generate valid account numbers. By reversing this
            calculation for the specific bank a sort code belongs to, we can verify whether the
            combination of sort code and account number is mathematically genuine.
          </p>
          <p>The validation process checks:</p>
          <CheckList
            items={[
              <>
                <strong className="text-foreground">Sort code format:</strong> Ensures the 6-digit
                code is valid
              </>,
              <>
                <strong className="text-foreground">Bank branch existence:</strong> Confirms the
                sort code is assigned to an active branch
              </>,
              <>
                <strong className="text-foreground">Modulus calculation:</strong> Verifies the
                account number using bank-specific algorithms
              </>,
              <>
                <strong className="text-foreground">Payment type support:</strong> Identifies which
                payment types the account accepts (BACS, CHAPS, Faster Payments, Direct Debit)
              </>,
            ]}
          />
          <p>
            Our database is updated weekly with the latest data from UK banks, building societies,
            and the Republic of Ireland, ensuring you always have access to accurate information. We
            cover 100% of UK and Irish sort codes - that&apos;s over 20,000 bank branches.
          </p>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading align="center" title="Who Uses Our Sort Code Checker?" />
        <FeatureGrid
          features={[
            {
              icon: Calculator,
              title: "Finance & Accounting Teams",
              text: "Validate supplier and customer bank details before processing payroll, invoices, and refunds.",
            },
            {
              icon: ShoppingCart,
              title: "E-commerce Platforms",
              text: "Verify customer refund details and marketplace seller accounts instantly.",
            },
            {
              icon: Home,
              title: "Property Management",
              text: "Check tenant bank details for Direct Debit setup and deposit refunds.",
            },
            {
              icon: Building2,
              title: "Utilities Companies",
              text: "Integrate real-time validation into payment flows to reduce failed transactions.",
            },
            {
              icon: Clock,
              title: "Subscription Businesses",
              text: "Validate Direct Debit mandates and ensure payment details are correct.",
            },
            {
              icon: Banknote,
              title: "Accountants & Bookkeepers",
              text: "Quickly verify client bank details when setting up BACS payments.",
            },
          ]}
        />
      </Section>

      <Section tone="navy">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Need to Validate Thousands of Sort Codes?
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Integrate our RESTful API for automated, high-volume validation. Perfect for payment
            platforms, accounting software, and enterprise systems. Process unlimited validations
            with &lt;50ms response times.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
          >
            <Link href="/docs">View API Docs</Link>
          </Button>
        </div>
      </Section>

      <Section narrow>
        <SectionHeading title="Frequently Asked Questions" />
        <FaqList items={faq} />
      </Section>

      <Section tone="mint">
        <SectionHeading
          align="center"
          title="Start Validating Sort Codes Today"
          lead="Join 1000+ businesses using Mintly to eliminate payment errors and save time."
        />
        <div className="mx-auto mt-10 max-w-2xl overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th scope="col" className="p-4">
                  Feature
                </th>
                <th scope="col" className="p-4">
                  Free Tool
                </th>
                <th scope="col" className="p-4">
                  Paid Plans
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["Checks", "10/week", "Unlimited"],
                ["Registration", "Not required", "14-day free trial"],
                ["Bank details", "Bank name only", "Branch, address & payment types"],
                ["Team & API access", "-", "Included"],
              ].map(([feature, free, paid]) => (
                <tr key={feature}>
                  <th scope="row" className="p-4 text-left font-medium">
                    {feature}
                  </th>
                  <td className="p-4">{free}</td>
                  <td className="p-4">{paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TrialCta />
      </Section>

      <Section>
        <SectionHeading title="Related Resources" />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block h-full rounded-xl border bg-card p-5 transition-colors hover:border-primary"
              >
                <span className="font-semibold text-primary">{item.title} →</span>
                <span className="mt-1 block text-sm text-muted-foreground">{item.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
