import type { Metadata } from "next";
import Link from "next/link";

import { FaqList } from "@/components/site/faq-list";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { PriceCalculator } from "@/components/site/price-calculator";
import { Section } from "@/components/site/section";
import { EISCD_PLAN, PLANS } from "@/lib/billing/plans";
import { type FaqItem, faqJsonLd, fullJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/pricing-calculator");

const { starter, standardPlus, professional } = PLANS;
const link = (href: string, text: string) => (
  <Link href={href} className="text-primary underline underline-offset-2">
    {text}
  </Link>
);

const faq: FaqItem[] = [
  {
    question: "How much does the Mintly bank account validation API cost?",
    answer: `<p>Plans start at ${starter.monthlyPrice} a month for ${starter.includedRequests} checks and run to ${professional.monthlyPrice} a month for ${professional.includedRequests} checks, with extra checks charged per request. Above 50,000 checks a month we quote volume pricing - 100,000 checks a month is £440, or 0.44p per check. All prices exclude VAT.</p>`,
  },
  {
    question: "What counts as a check?",
    answer:
      "<p>One request to the production API counts as one check against your monthly allowance, whether you validate a sort code alone or a full sort code and account number. Requests to the sandbox are free and do not count.</p>",
  },
  {
    question: "What happens if I go over my monthly allowance?",
    answer: `<p>Nothing breaks. Checks above your allowance are billed at your plan's per-check rate - ${starter.pricePerRequest} on Starter, ${standardPlus.pricePerRequest} on Standard Plus and ${professional.pricePerRequest} on Professional - and added to your next invoice. If you are regularly over, a larger plan usually costs less.</p>`,
  },
  {
    question: "Is the EISCD data file included in a plan?",
    answer: `<p>No. The Extended Industry Sort Code Directory is licensed separately at ${EISCD_PLAN.annualPrice} a year excluding VAT, and is billed annually rather than per check. The calculator adds it to your total if you need it.</p>`,
  },
  {
    question: "Do I need a card to try the API?",
    answer: "<p>No. The 14-day trial includes 100 checks and starts without a payment method.</p>",
  },
];

export default function PricingCalculatorPage() {
  return (
    <>
      <JsonLd
        data={[
          fullJsonLd(pageInfo("/pricing-calculator", "API Price Calculator", "2026-08-24")),
          faqJsonLd("pricing-calculator#faq", faq),
        ]}
      />
      <PageHero
        compact
        crumbs={[{ label: "Pricing", href: "/pricing" }, { label: "Price Calculator" }]}
        title="API Price Calculator"
        lead="Tell us roughly how many bank account checks you expect each month and we will work out which plan costs least, what the extras come to, and what you would pay per check."
      />

      <Section>
        <PriceCalculator />
      </Section>

      <Section tone="muted">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <h2 className="font-semibold">No sign-up</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The calculator runs entirely in your browser. Nothing is sent to us and there is no
              form to fill in first.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">Published prices</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              It uses the same plan prices as our {link("/pricing", "pricing page")}, so the figures
              you see here are the figures you pay.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">EISCD included</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              If you licence the {link("/eiscd", "sort code directory")} as well, we add it to the
              total rather than leaving you to.
            </p>
          </div>
        </div>
      </Section>

      <Section narrow>
        <article className="prose max-w-none prose-a:text-primary">
          <h2>How our pricing works</h2>
          <p>
            Every plan comes with a monthly allowance of checks. Stay inside it and you pay the plan
            price and nothing else. Go over it and the extra checks are billed at your plan&apos;s
            per-check rate, which falls as the plans get larger - {starter.pricePerRequest} on
            Starter, {standardPlus.pricePerRequest} on Standard Plus and{" "}
            {professional.pricePerRequest} on Professional.
          </p>
          <p>
            That is why the cheapest plan is not always the smallest one. At 5,000 checks a month
            the Starter plan plus overage costs more than Standard Plus outright, so the calculator
            recommends Standard Plus. It costs every plan at your volume and picks the lowest, then
            shows you the full table so you can see why.
          </p>
          <p>
            Above 50,000 checks a month we stop selling from the price list and quote volume pricing
            instead. Those bands are shown in the calculator with an indicative price - 100,000
            checks a month is £440, or 0.44p a check - and confirmed on a short call.
          </p>
          <h2>What counts as a check</h2>
          <p>
            One request to the production API is one check, whether you are validating a sort code
            on its own or a sort code and account number together. Requests to the sandbox return
            fixed responses and are free, so you can build and test an integration without touching
            your allowance. Checks run through the web portal count the same as checks through the
            API.
          </p>
          <p>
            Users are people who sign in to the portal, not API keys. A single developer with an API
            key serving a whole platform is one user.
          </p>
          <h2>The EISCD licence</h2>
          <p>
            The Extended Industry Sort Code Directory is the underlying data rather than a service
            that checks accounts for you. It is licensed annually at {EISCD_PLAN.annualPrice}{" "}
            excluding VAT and updated weekly, and it is priced per customer depending on how you use
            it and how many sites it covers. The calculator adds the standard licence to your total;
            if you need a single extract, less frequent downloads, or cover for more than one site,{" "}
            <Link href="/eiscd-api">the EISCD API page</Link> explains the options and we will quote
            for them.
          </p>
        </article>
      </Section>

      <Section tone="muted" narrow>
        <h2 className="text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
        <FaqList items={faq} />
      </Section>

      <Section narrow>
        <h2 className="text-3xl font-semibold tracking-tight">Ready to start?</h2>
        <p className="mt-4 text-muted-foreground">
          Every plan comes with a 14-day trial and 100 checks, and needs no payment method to begin.{" "}
          {link("/get-started", "Get started")}, read the {link("/docs", "API documentation")}, or
          compare us against other providers on our{" "}
          {link("/pricing-comparison", "pricing comparison")} page.
        </p>
      </Section>
    </>
  );
}
