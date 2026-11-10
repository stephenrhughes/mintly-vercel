import {
  Bot,
  CheckCircle2,
  Code2,
  CreditCard,
  Database,
  Globe2,
  Landmark,
  Lock,
  RefreshCw,
  Rocket,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { CheckList } from "@/components/site/check-list";
import { CodeBlock } from "@/components/site/code-block";
import { CodeTabs } from "@/components/site/code-tabs";
import { FaqList } from "@/components/site/faq-list";
import { FeatureGrid } from "@/components/site/feature-grid";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { PlanSummaryCards } from "@/components/site/plan-summary-cards";
import { Section, SectionHeading } from "@/components/site/section";
import { Testimonials } from "@/components/site/testimonials";
import { Button } from "@/components/ui/button";
import { type FaqItem, faqJsonLd, fullJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/bank-account-validation-api");

const link = (href: string, text: string) => (
  <Link href={href} className="text-primary underline underline-offset-2">
    {text}
  </Link>
);

const ENDPOINT = "https://api.mintly.uk/bankAccount/v1/sortcode/200000/account/12345678";

const samples = [
  {
    label: "Node.js",
    language: "javascript",
    code: `// Node.js — bank account validation API example
const response = await fetch(
  '${ENDPOINT}',
  {
    headers: {
      'X-API-KEY': 'YOUR_API_KEY',
      'Content-Type': 'application/json',
    },
  }
)

const data = await response.json()
console.log(data)`,
  },
  {
    label: "Python",
    language: "python",
    code: `# Python — bank account validation API example
import requests

response = requests.get(
    '${ENDPOINT}',
    headers={
        'X-API-KEY': 'YOUR_API_KEY',
        'Content-Type': 'application/json',
    }
)

data = response.json()
print(data)`,
  },
  {
    label: "C#",
    language: "csharp",
    code: `// C# — bank account validation API example
using System.Net.Http;
using System.Net.Http.Headers;

var client = new HttpClient();
var request = new HttpRequestMessage(
    HttpMethod.Get,
    "${ENDPOINT}"
);
request.Headers.Add("X-API-KEY", "YOUR_API_KEY");
request.Headers.Add("Content-Type", "application/json");

var response = await client.SendAsync(request);
response.EnsureSuccessStatusCode();
Console.WriteLine(await response.Content.ReadAsStringAsync());`,
  },
];

const jsonResponse = `{
  "Status": "Valid",
  "ModulusCheckCompleted": true,
  "BranchData": {
    "Info": {
      "SortCode": "200000",
      "BicField1": "",
      "BicField2": "",
      ...
    },
    "PaymentTypes": {
      "DirectDebitAccepted": true,
      "DirectCreditAccepted": true,
      ...
    }
  }
}`;

const apiFeatures = [
  { icon: Zap, title: "Response time", text: "<50ms average, measured at API layer" },
  { icon: Database, title: "Data source", text: "EISCD - official Vocalink sort code directory" },
  { icon: RefreshCw, title: "Update frequency", text: "Weekly data updates" },
  { icon: CheckCircle2, title: "UK coverage", text: "100% of all registered sort codes" },
  { icon: Globe2, title: "IBAN coverage", text: "89 countries, full check-digit validation" },
  {
    icon: ShieldCheck,
    title: "Modulus algorithms",
    text: "Modulus algorithms as used by all UK banks",
  },
  { icon: Rocket, title: "Rate limits", text: "Up to 2,500 req/sec (Enterprise plan)" },
  { icon: Lock, title: "Authentication", text: "API key via HTTP header" },
  { icon: Code2, title: "Format", text: "JSON responses served over HTTPS" },
  { icon: Server, title: "Specification", text: "OpenAPI 3.0 - importable into Postman, Insomnia" },
  {
    icon: CheckCircle2,
    title: "Sandbox",
    text: "Full test environment with known pass/fail values",
  },
  {
    icon: Bot,
    title: "MCP Server",
    text: "Compatible - integrate directly with Claude and AI agents",
  },
];

const faq: FaqItem[] = [
  {
    question: "Does the API store the bank account numbers I submit?",
    answer:
      "<p>No. Mintly does not persist account numbers submitted via the API. Each request is validated in real time against our hosted EISCD dataset and discarded immediately.</p>",
  },
  {
    question: "What's the difference between sort code validation and modulus checking?",
    answer:
      "<p>Sort code validation confirms the sort code exists in the EISCD directory and returns bank and branch details. Modulus checking is an additional layer that mathematically verifies the sort code and account number combination follows the correct pattern — catching transpositions and keying errors that sort code validation alone cannot detect.</p>",
  },
  {
    question: "Is there a sandbox environment for testing?",
    answer:
      '<p>Yes. All plans include access to a full sandbox with documented test cases for valid accounts, invalid sort codes, and modulus check failures. See the <a href="/docs">API docs</a> for the complete list of test values.</p>',
  },
  {
    question: "What happens if a sort code isn't in the EISCD?",
    answer:
      "<p>The API returns a <code>404</code> result with a clear error code. Sort codes are removed from the EISCD when a branch closes — if you're seeing unexpected not-found results, the sort code may have been recently retired. Mintly ingests EISCD updates weekly, so the dataset is always current.</p>",
  },
  {
    question: "How current is the sort code data?",
    answer:
      "<p>The EISCD is updated weekly. As a VocaLink Authorised Distributor, Mintly ingests each new release as it is issued — giving you the same authoritative dataset that the UK banking system itself relies on.</p>",
  },
  {
    question: "Can I use the API with Zapier or no-code tools?",
    answer:
      '<p>Yes. Integration guides are available for Zapier, Power Automate, and Salesforce — no code required. See the <a href="/integration-guides">integration guides</a> for step-by-step instructions.</p>',
  },
];

const useCases = [
  {
    title: "Pre-BACS submission checks",
    text: (
      <>
        Validate account details before submitting {link("/articles/bacs-and-direct-debit", "BACS")}{" "}
        files to eliminate return items and Bacs Service User charges. A single failed payment can
        cost more than the annual subscription — catching invalid accounts at source is the simplest
        risk control available.
      </>
    ),
  },
  {
    title: "Direct Debit AUDDIS onboarding",
    text: (
      <>
        Verify new payer account details at sign-up before the first{" "}
        {link("/articles/auddis", "AUDDIS")} instruction is submitted, reducing failed first
        collections. Validating at onboarding — rather than on payment day — prevents the customer
        churn that follows a failed first Direct Debit.
      </>
    ),
  },
  {
    title: "Customer onboarding forms",
    text: "Inline validation on payment or banking detail capture forms prevents incorrect data from entering your system at source. Integrate the sort code validation API directly into your web form to surface errors in real time, before the customer clicks submit.",
  },
  {
    title: "Payroll and B2B payments",
    text: "Validate supplier or employee bank details before payment runs to eliminate manual re-work from failed payments. Modulus checking catches the transposition errors that are common when employees self-report account numbers via HR systems.",
  },
];

export default function BankAccountValidationApiPage() {
  return (
    <>
      <JsonLd
        data={[
          fullJsonLd(
            pageInfo(
              "/bank-account-validation-api",
              "UK Bank Account Validation API",
              "2026-06-22",
            ),
          ),
          faqJsonLd("bank-account-validation-api#faq", faq),
        ]}
      />
      <PageHero
        title="UK Bank Account Validation API"
        lead={
          <p>
            Validate sort codes, account numbers, IBANs, and SWIFT/BIC codes in real time. 100%
            coverage of UK banks via the official{" "}
            <Link href="/eiscd" className="underline">
              EISCD dataset
            </Link>
            , updated weekly.
          </p>
        }
        actions={
          <>
            <Button
              asChild
              size="lg"
              className="bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
            >
              <Link href="/pricing">Start free 14-day trial</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/docs">View API docs</Link>
            </Button>
          </>
        }
      >
        <ul className="mt-8 flex flex-wrap gap-2 text-sm">
          {["<50ms response", "100% UK coverage", "99.95% uptime", "89 countries (IBAN)"].map(
            (badge) => (
              <li key={badge} className="rounded-full bg-white/10 px-3 py-1">
                {badge}
              </li>
            ),
          )}
        </ul>
      </PageHero>

      <Section>
        <SectionHeading align="center" title="What Mintly's API Validates" />
        <FeatureGrid
          features={[
            {
              icon: Landmark,
              title: "Sort code validation",
              text: (
                <>
                  Verifies the sort code against the {link("/eiscd", "EISCD")} (Extended Industry
                  Sort Code Directory), maintained by Vocalink/Pay.UK. Returns bank name, branch
                  address, and supported payment types. Learn more in our{" "}
                  {link("/articles/sortcodes", "sort code guide")}.
                </>
              ),
            },
            {
              icon: ShieldCheck,
              title: "Account number modulus checking",
              text: (
                <>
                  Applies {link("/articles/modulus-checking", "modulus checking")} algorithms 10 and
                  11 to confirm the sort code and account number pairing follows a valid
                  mathematical pattern - catching transpositions and keying errors before they reach
                  the payment network.
                </>
              ),
            },
            {
              icon: CreditCard,
              title: "Payment type detection",
              text: "Identifies which schemes the account supports: BACS, CHAPS, Faster Payments, and Direct Debit. Essential for routing payments correctly and avoiding failed submissions to unsupported schemes.",
            },
            {
              icon: Globe2,
              title: "Global IBAN validation",
              text: (
                <>
                  Validates IBAN structure and country-specific check digits for 89 countries. Goes
                  beyond basic format checks - our {link("/articles/swift-iban", "IBAN validation")}{" "}
                  applies national check digit algorithms where they exist.
                </>
              ),
            },
            {
              icon: Globe2,
              title: "SWIFT/BIC validation",
              text: "Verifies international bank identifiers against the global BIC directory. Returns the associated institution name and country, allowing you to confirm the beneficiary bank before initiating a cross-border payment.",
            },
          ]}
        />
      </Section>

      <Section tone="muted">
        <SectionHeading
          title="Integrate in Minutes"
          lead="A single REST call returns full validation results. Pick your language and copy the example - the sort code and account number below are real-format test values."
        />
        <div className="mt-8">
          <h3 className="font-semibold">Example API Request</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Just a few lines of code are required to call our RESTful API
          </p>
          <div className="mt-4">
            <CodeTabs samples={samples} />
          </div>
          <h3 className="mt-6 font-semibold">API JSON Response</h3>
          <CodeBlock code={jsonResponse} language="json" title="Response" />
          <p className="text-muted-foreground">
            The API is fully RESTful with an OpenAPI 3.0 specification. Integration guides are
            available for Node.js, Python, C#, PHP, Salesforce, Power Automate, and Zapier — see{" "}
            {link("/integration-guides", "integration guides")} or the {link("/docs", "API docs")}.
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading
          align="center"
          title="API Features"
          lead="Everything a developer needs - fast data, clean responses, and full test coverage out of the box."
        />
        <FeatureGrid features={apiFeatures} columns={4} />
      </Section>

      <Section tone="mint">
        <SectionHeading
          align="center"
          title="Simple Pricing - Try Free for 14 Days"
          lead="No credit card required for your free trial. Cancel or change plan any time."
        />
        <PlanSummaryCards />
        <p className="mt-8 text-center text-muted-foreground">
          All plans include a 14-day free trial with no credit card required. Enterprise and volume
          plans available - {link("/about#contact", "contact us")}.
        </p>
        <div className="mt-6 text-center">
          <Button asChild>
            <Link href="/pricing">See full pricing breakdown</Link>
          </Button>
        </div>
      </Section>

      <Section>
        <SectionHeading title="Built for Production. Trusted by UK Businesses." />
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <CheckList
            items={[
              <>
                <strong>VocaLink Authorised Distributor</strong> - direct data provenance chain to
                Pay.UK, the operator of the EISCD
              </>,
              <>
                <strong>Crown Commercial Service G-Cloud 14</strong> Lot 2 supplier - available to
                UK public sector without a separate procurement process
              </>,
              <>
                <strong>Cyber Essentials certified</strong> - NCSC-accredited baseline security
                certification
              </>,
              <>
                <strong>GDPR compliant &amp; UK data residency</strong> - data processed and stored
                within the United Kingdom
              </>,
              <>
                <strong>99.95% uptime SLA</strong> (Enterprise plans) with a public status page
              </>,
            ]}
          />
          <div className="space-y-4 text-muted-foreground">
            <p>
              Mintly is built to meet the security and compliance requirements of enterprise
              procurement teams.
            </p>
            <p>
              Account numbers submitted to the bank account validation API are never persisted. Each
              validation request is processed in real time against our hosted EISCD dataset and
              discarded immediately after the response is returned.
            </p>
          </div>
        </div>
        <Testimonials />
      </Section>

      <Section tone="muted">
        <SectionHeading
          title="Common Use Cases"
          lead="The bank account validation API fits wherever UK payment data enters or leaves your system."
        />
        <FeatureGrid features={useCases} columns={2} />
      </Section>

      <Section narrow>
        <SectionHeading title="Frequently Asked Questions" />
        <FaqList items={faq} />
      </Section>

      <section className="bg-brand-navy text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Start Validating in Minutes</h2>
          <p className="mt-4 text-lg text-white/80">
            No credit card required. 14-day free trial with up to 50 checks per day. Full API access
            from day one.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
            >
              <Link href="/get-started">Start Free Trial</Link>
            </Button>
            <BookDemoButton size="lg" variant="onDark" />
          </div>
          <p className="mt-6 text-sm text-white/70">
            Questions?{" "}
            <Link href="/about" className="underline">
              Contact us.
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
