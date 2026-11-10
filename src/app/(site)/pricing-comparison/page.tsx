import type { Metadata } from "next";
import Link from "next/link";

import { CheckList } from "@/components/site/check-list";
import { CtaBand } from "@/components/site/cta-band";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { Testimonials } from "@/components/site/testimonials";
import { buildQuote, formatPence } from "@/lib/billing/price-calculator";
import { API_STATUS_URL } from "@/lib/marketing/contact";
import { fullJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/pricing-comparison");

// Competitor figures are their published prices when last checked; update
// the date whenever they're re-verified.
const PRICES_LAST_VERIFIED = "10 July 2026";
const mintlyAt10k = formatPence(buildQuote({ requests: 10_000 }).pencePerCheck);

const providers = ["Mintly", "esortcode", "postcoder.com", "Loqate"];
const rows: { metric: string; note?: string; values: [React.ReactNode, string, string, string] }[] =
  [
    {
      metric: "Price per modulus check",
      note: "Based on 10,000 monthly checks",
      values: [<strong key="m">{mintlyAt10k}</strong>, "2.4p", "3.0p", "from 2.4p"],
    },
    {
      metric: "Buy credits",
      values: [
        <>
          Not required
          <span className="block text-xs text-muted-foreground">usage-based billing</span>
        </>,
        "Monthly subscription",
        "Credits last 12 months",
        "Credits last 12 months",
      ],
    },
    {
      metric: "Free Checks in trial",
      values: [
        <>
          100
          <span className="block text-xs text-muted-foreground">
            cancel anytime, 14-day free trial
          </span>
        </>,
        "50",
        "Not disclosed",
        "Not disclosed",
      ],
    },
    {
      metric: "Onboarding Help",
      values: [
        <>
          Unlimited
          <span className="block text-xs text-muted-foreground">
            Help during setup and ongoing support
          </span>
        </>,
        "Not disclosed",
        "Onboarding included",
        "Not disclosed",
      ],
    },
  ];

export default function PricingComparisonPage() {
  return (
    <>
      <JsonLd
        data={fullJsonLd(pageInfo("/pricing-comparison", "Pricing Comparison", "2026-07-10"))}
      />
      <PageHero
        compact
        crumbs={[{ label: "Pricing", href: "/pricing" }, { label: "Pricing Comparison" }]}
        title="Bank Validation Pricing Compared"
        lead="Per-check pricing for Mintly, esortcode, postcoder.com, and Loqate, side by side."
      />

      <Section>
        <SectionHeading
          title="How the pricing compares"
          lead={`Prices last verified: ${PRICES_LAST_VERIFIED}`}
        />
        <div className="mt-8 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="p-4 text-left">
                  Metric
                </th>
                {providers.map((name, i) => (
                  <th key={name} scope="col" className={i === 0 ? "bg-secondary p-4" : "p-4"}>
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.metric}>
                  <th scope="row" className="p-4 text-left font-medium">
                    {row.metric}
                    {row.note && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {row.note}
                      </span>
                    )}
                  </th>
                  {row.values.map((value, i) => (
                    <td
                      key={i}
                      className={i === 0 ? "bg-secondary/60 p-4 text-center" : "p-4 text-center"}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Mintly per-check price varies by plan – see{" "}
          <Link href="/pricing" className="underline">
            full pricing plans
          </Link>{" "}
          for exact rates at each volume tier. Competitor figures are publicly listed prices /
          features at time of verification and are subject to change; see each provider&apos;s own
          site for current terms.
        </p>
      </Section>

      <Section tone="muted">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Why we&apos;re cheaper</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Mintly runs cost-efficient infrastructure, and doesn&apos;t have a pushy sales team
                to pay. We also specialise in providing <em>one service</em>. Unlike other providers
                we don&apos;t provide postcode, address or geolocation services. We don&apos;t
                provide payment services. This allows us to focus on Bank Account validation
                services.
              </p>
              <p>
                We aim to provide the best technology and customer support, at the best price
                possible.
              </p>
              <p>It&apos;s as simple as that.</p>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <p className="text-muted-foreground">
              We created Mintly&apos;s APIs to provide better value to Enterprise customers. With a
              subscription you get:
            </p>
            <CheckList
              className="mt-4 text-sm"
              items={[
                "Unlimited checks on sort codes, bank accounts, IBAN and Swift.",
                "Free tier on each plan, then pay for what you use.",
                "Super fast response rates, average under 50ms.",
                <>
                  Reliable availability at least 99.95%{" "}
                  <a href={API_STATUS_URL} rel="noopener" className="text-primary underline">
                    uptime
                  </a>
                  .
                </>,
                "Onboarding and continued support.",
                "No minimum term. Cancel any time.",
                "Service Level Agreement for Enterprise plans.",
              ]}
            />
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading align="center" title="What our customers say" />
        <Testimonials />
      </Section>

      <CtaBand
        title="Get an API key and start validating"
        lead="Start your 14-day free trial today – no credit card required."
      />
    </>
  );
}
