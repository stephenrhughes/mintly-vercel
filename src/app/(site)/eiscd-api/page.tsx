import {
  Bot,
  CheckCircle2,
  Clock,
  Code2,
  FileArchive,
  KeyRound,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { CheckList } from "@/components/site/check-list";
import { CodeTabs } from "@/components/site/code-tabs";
import { EiscdProduct } from "@/components/site/eiscd-product";
import { FaqList } from "@/components/site/faq-list";
import { FeatureGrid } from "@/components/site/feature-grid";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { Testimonials } from "@/components/site/testimonials";
import { Button } from "@/components/ui/button";
import { eiscdJsonLd, type FaqItem, faqJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/eiscd-api");

const link = (href: string, text: string) => (
  <Link href={href} className="text-primary underline underline-offset-2">
    {text}
  </Link>
);
const code = (text: string) => <code className="rounded bg-muted px-1 py-0.5 text-sm">{text}</code>;

const BASE = "https://api.mintly.uk/eiscd";

const samples = [
  {
    label: "Node.js",
    language: "javascript",
    code: `// Download the full EISCD as CSV
const response = await fetch(
  '${BASE}/eiscd-csv.zip',
  { headers: { 'X-API-KEY': 'YOUR_API_KEY' } }
)

if (!response.ok) {
  throw new Error(\`EISCD request failed: HTTP \${response.status}\`)
}

const buffer = Buffer.from(await response.arrayBuffer())
require('fs').writeFileSync('eiscd-latest.zip', buffer)
console.log('Saved eiscd-latest.zip')

// Weekly delta file (only the changes since last week)
const deltaResponse = await fetch(
  '${BASE}/delta-files/2026/week-27/eiscd-delta.txt',
  { headers: { 'X-API-KEY': 'YOUR_API_KEY' } }
)
const delta = await deltaResponse.text()
// Each line: NEW | UPDATED | DELETED, then tab-delimited fields
console.log(delta.split('\\n')[0])`,
  },
  {
    label: "Python",
    language: "python",
    code: `# Python — download the full EISCD as CSV
import requests

response = requests.get(
    '${BASE}/eiscd-csv.zip',
    headers={'X-API-KEY': 'YOUR_API_KEY'},
)
response.raise_for_status()

with open('eiscd-latest.zip', 'wb') as f:
    f.write(response.content)
print('Saved eiscd-latest.zip')

# Weekly delta file — only the changes since last week
delta_response = requests.get(
    '${BASE}/delta-files/2026/week-27/eiscd-delta.txt',
    headers={'X-API-KEY': 'YOUR_API_KEY'},
)
# Each line: NEW | UPDATED | DELETED, then tab-delimited fields
print(delta_response.text.splitlines()[0])`,
  },
  {
    label: "C#",
    language: "csharp",
    code: `// C# — download the full EISCD as CSV
using System.Net.Http;

var client = new HttpClient();
var request = new HttpRequestMessage(
    HttpMethod.Get,
    "${BASE}/eiscd-csv.zip"
);
request.Headers.Add("X-API-KEY", "YOUR_API_KEY");

var response = await client.SendAsync(request);
response.EnsureSuccessStatusCode();

var bytes = await response.Content.ReadAsByteArrayAsync();
await File.WriteAllBytesAsync("eiscd-latest.zip", bytes);
Console.WriteLine("Saved eiscd-latest.zip");

// Weekly delta file — only the changes since last week
var deltaRequest = new HttpRequestMessage(
    HttpMethod.Get,
    "${BASE}/delta-files/2026/week-27/eiscd-delta.txt"
);
deltaRequest.Headers.Add("X-API-KEY", "YOUR_API_KEY");
var deltaResponse = await client.SendAsync(deltaRequest);
var delta = await deltaResponse.Content.ReadAsStringAsync();
// Each line: NEW | UPDATED | DELETED, then tab-delimited fields
Console.WriteLine(delta.Split('\\n')[0]);`,
  },
];

const features = [
  {
    icon: FileArchive,
    title: "Full snapshot formats",
    text: "TXT, CSV, XML, or XLSX — pick the format that fits your pipeline",
  },
  {
    icon: RefreshCw,
    title: "Weekly delta endpoint",
    text: "NEW / UPDATED / DELETED changes only, no need to re-download the full file",
  },
  {
    icon: Clock,
    title: "Update schedule",
    text: "New files published every Friday from 12:00 GMT, valid from the following Monday",
  },
  {
    icon: CheckCircle2,
    title: "UK coverage",
    text: "100% of registered UK sort codes, 20,000+ branches",
  },
  { icon: Lock, title: "Authentication", text: "API key via HTTP header" },
  {
    icon: Code2,
    title: "Format",
    text: "REST over HTTPS, application/zip and application/octet-stream responses",
  },
  { icon: Server, title: "Specification", text: "OpenAPI 3.0 — importable into Postman, Insomnia" },
  {
    icon: ShieldCheck,
    title: "Data provenance",
    text: "VocaLink/Pay.UK authorised distributor — direct chain to the source",
  },
  {
    icon: Bot,
    title: "AI Agent Skill",
    text: "Downloadable skill for Claude Code, Copilot, Cursor, Codex, and Gemini CLI",
  },
];

const faq: FaqItem[] = [
  {
    question: "Is there a sandbox environment for the EISCD API?",
    answer:
      "<p>No. The EISCD API only has a production environment - there is no sandbox. All requests are made against live, current EISCD data. We can provide a test environment for Proof of Concept that serves dummy data.</p>",
  },
  {
    question: "How current is the EISCD data?",
    answer:
      "<p>New EISCD files are published every Friday from 12:00 GMT, and the data is valid from the following Monday. As a VocaLink authorised distributor, Mintly ingests each release as it is issued.</p>",
  },
  {
    question: "What's the difference between the base file and the delta endpoint?",
    answer:
      "<p>The base file endpoints return the complete, current EISCD snapshot. The delta endpoint returns only the changes since the previous week, with each record flagged <code>NEW</code>, <code>UPDATED</code>, or <code>DELETED</code> - ideal for keeping a local mirror in sync without re-downloading the full file every week.</p>",
  },
  {
    question: "What formats does the API support?",
    answer:
      "<p>The full EISCD snapshot is available as TXT (tab-delimited), CSV, XML, or XLSX. Weekly delta files are available in tab-delimited TXT format only.</p>",
  },
  {
    question: "Can multiple people at my organisation use the EISCD?",
    answer:
      '<p>Yes. EISCD licensing covers your whole organisation on a single-site basis - you are permitted to load the EISCD data into multiple systems at the same site. Redistribution to separate legal entities isn\'t permitted. See our <a href="/eiscd-terms">EISCD Terms &amp; Conditions</a> for full details.</p>',
  },
  {
    question: "Does the EISCD API validate individual bank accounts?",
    answer:
      '<p>No. The EISCD API delivers the sort code directory itself - bank names, branch addresses, and payment scheme participation. If you need to validate specific sort codes and account numbers in real time, including modulus checking, use the <a href="/bank-account-validation-api">Bank Account Validation API</a> instead.</p>',
  },
];

export default function EiscdApiPage() {
  return (
    <>
      <JsonLd
        data={[
          eiscdJsonLd(pageInfo("/eiscd-api", "EISCD API", "2026-07-02")),
          faqJsonLd("eiscd-api#faq", faq),
        ]}
      />
      <PageHero
        title="EISCD API"
        lead={
          <p>
            Pull the complete UK sort code directory - or just the weekly changes - straight into
            your systems via a RESTful API. Over 20,000 sort codes, updated every Friday, as an
            official{" "}
            <Link href="/eiscd" className="underline">
              EISCD
            </Link>{" "}
            authorised distributor.
          </p>
        }
        actions={
          <>
            <BookDemoButton
              meeting="eiscd"
              label="Get API access"
              size="lg"
              variant="default"
              showIcon={false}
              className="bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
            />
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/eiscd-docs">View API docs</Link>
            </Button>
          </>
        }
      >
        <ul className="mt-8 flex flex-wrap gap-2 text-sm">
          {["20,000+ sort codes", "Weekly updates", "4 file formats", "Authorised distributor"].map(
            (badge) => (
              <li key={badge} className="rounded-full bg-white/10 px-3 py-1">
                {badge}
              </li>
            ),
          )}
        </ul>
      </PageHero>

      <Section>
        <SectionHeading align="center" title="What You Get From the API" />
        <FeatureGrid
          columns={4}
          features={[
            {
              icon: FileArchive,
              title: "Full base file endpoints",
              text: (
                <>
                  Get the current EISCD snapshot in the format your systems need. We can provide{" "}
                  {code("TXT")}, {code("CSV")}, {code("XML")} and {code("XLSX")} files.
                </>
              ),
            },
            {
              icon: RefreshCw,
              title: "Weekly delta endpoint",
              text: (
                <>
                  Our delta endpoint returns only what changed since the previous week, with each
                  record flagged {code("NEW")}, {code("UPDATED")}, or {code("DELETED")}.
                </>
              ),
            },
            {
              icon: KeyRound,
              title: "Simple API key authentication",
              text: (
                <>
                  Every request is authorised with a single {code("X-API-KEY")} HTTP header - no
                  OAuth flow, no token refresh to manage.
                </>
              ),
            },
            {
              icon: ShieldCheck,
              title: "Data straight from the source",
              text: "Mintly is a VocaLink authorised distributor, so every file we serve traces directly back to the official EISCD release.",
            },
          ]}
        />
      </Section>

      <Section tone="muted">
        <SectionHeading
          title="Integrate in Minutes"
          lead="A single REST call downloads the full dataset or a weekly delta. Pick your language and copy the example."
        />
        <div className="mt-8">
          <h3 className="font-semibold">Example API Request</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Just a few lines of code are required to call our RESTful API
          </p>
          <div className="mt-4">
            <CodeTabs samples={samples} />
          </div>
          <p className="text-muted-foreground">
            The API is fully RESTful with an OpenAPI 3.0 specification - importable straight into
            Postman or Insomnia. See the {link("/eiscd-docs", "API docs")} for the full reference.
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading
          align="center"
          title="API Features"
          lead="Everything a developer needs to pull EISCD data into their own systems and keep it current."
        />
        <FeatureGrid features={features} />
      </Section>

      <Section tone="mint">
        <SectionHeading
          align="center"
          title="Simple, Flat-Rate Licensing"
          lead="One annual licence, unlimited use across your organisation* - no per-request metering to worry about."
        />
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_1fr]">
          <EiscdProduct />
          <div className="rounded-xl border bg-card p-6 text-sm shadow-xs">
            <h3 className="font-semibold">* Important Licensing Information</h3>
            <p className="mt-3 text-muted-foreground">
              EISCD licensing allows use throughout your entire organisation. The whole organisation
              must access the same original copy - redistribution to separate entities isn&apos;t
              permitted. See our {link("/eiscd-terms", "EISCD Terms & Conditions")} for full
              details.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading title="Built for Production. Trusted by UK Businesses." />
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <CheckList
            items={[
              <>
                <strong>VocaLink Authorised Distributor</strong> - direct data provenance chain to
                VocaLink, the operator of the EISCD
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
                <strong>Cloud hosted, 24/7/365 availability</strong> - download or access via API
                anytime, no maintenance required on your end
              </>,
            ]}
          />
          <div className="space-y-4 text-muted-foreground">
            <p>
              Mintly is built to meet the security and compliance requirements of enterprise
              procurement teams.
            </p>
            <p>
              Need account-level validation too? Our{" "}
              {link("/bank-account-validation-api", "Bank Account Validation API")} combines this
              same EISCD data with modulus checking to validate sort codes and account numbers in
              real time.
            </p>
          </div>
        </div>
        <Testimonials />
      </Section>

      <Section tone="muted">
        <SectionHeading
          title="Common Use Cases"
          lead="The EISCD API fits anywhere your systems need authoritative UK sort code data, not just a one-off lookup."
        />
        <FeatureGrid
          columns={2}
          features={[
            {
              title: "Seeding a local sort code database",
              text: (
                <>
                  Pull the full {code("eiscd-csv.zip")} or {code("eiscd-text.zip")} snapshot to
                  populate your own database, rather than maintaining a manual spreadsheet that
                  quickly goes stale.
                </>
              ),
            },
            {
              title: "Keeping a mirror in sync",
              text: (
                <>
                  Schedule a Friday job against the delta endpoint to apply only the {code("NEW")},{" "}
                  {code("UPDATED")}, and {code("DELETED")} records each week, instead of
                  re-downloading and re-importing the entire file.
                </>
              ),
            },
            {
              title: "Payment scheme routing",
              text: "Each EISCD record includes BACS, CHAPS, and Faster Payments participation for the branch, so you can route or reject payments to the correct scheme before submission.",
            },
            {
              title: "AI-assisted integration",
              text: (
                <>
                  Download the EISCD Agent Skill from the {link("/eiscd-docs", "API docs")} page to
                  get Claude, Copilot, or Cursor to write your sync script, parse delta files, or
                  schedule the weekly job for you.
                </>
              ),
            },
          ]}
        />
      </Section>

      <Section narrow>
        <SectionHeading title="Frequently Asked Questions" />
        <FaqList items={faq} />
      </Section>

      <section className="bg-brand-navy text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">
            Start Integrating the EISCD API Today
          </h2>
          <p className="mt-4 text-lg text-white/80">
            One flat annual licence covers your whole organisation. Get an API key and start pulling
            data in minutes.
          </p>
          <div className="mt-8 flex justify-center">
            <BookDemoButton meeting="eiscd" size="lg" variant="onDark" />
          </div>
          <p className="mt-6 text-sm text-white/70">
            Authorised distributor • Weekly updates • Multiple formats •{" "}
            <Link href="/about" className="underline">
              Questions? Contact us.
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
