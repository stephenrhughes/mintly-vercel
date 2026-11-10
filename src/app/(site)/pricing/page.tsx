import type { Metadata } from "next";
import Link from "next/link";

import { CheckList } from "@/components/site/check-list";
import { EiscdProduct } from "@/components/site/eiscd-product";
import { Enquiry } from "@/components/site/enquiry/enquiry";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { PricingCards } from "@/components/site/pricing-cards";
import { Section } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { fullJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/pricing");

function Group({ title, items }: { title: string; items: React.ReactNode[] }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <CheckList className="mt-3 text-sm text-muted-foreground" items={items} />
    </div>
  );
}

export default function PricingPage() {
  return (
    <>
      <JsonLd data={fullJsonLd(pageInfo("/pricing", "Pricing", "2022-10-05"))} />
      <PageHero
        compact
        title="Simple pricing, making bank account checking easy!"
        lead="We won't make you commit to buying credits or send you confusing invoices. Try with no commitment for 14 days!"
      />

      <Section>
        <h2 className="mb-8 text-center text-2xl font-semibold">
          Bank Account Checker API &amp; Web
        </h2>
        <PricingCards />
        <p className="mt-6 text-center">
          <Link href="/pricing-calculator" className="text-primary underline">
            Work out your monthly cost with our price calculator
          </Link>
        </p>
      </Section>

      <Section tone="muted">
        <h2 className="text-center text-3xl font-semibold tracking-tight">
          All our plans share great core features
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <Group
            title="Data Features"
            items={[
              "Validate sort codes, account numbers, BIC, and IBAN.",
              "Data updated every week so your results stay accurate.",
              "Monitor your daily usage in your dashboard.",
            ]}
          />
          <Group
            title="Tools, Integrations & Team"
            items={[
              "Use API, web tools, and integrations with one subscription.",
              "Developer-friendly API docs and example code for fast integration.",
              "Team support: manage access under one subscription.",
            ]}
          />
          <Group
            title="Pricing & Plans"
            items={[
              <>
                Low,{" "}
                <Link href="/pricing-comparison" className="text-primary underline">
                  competitive prices
                </Link>{" "}
                with free requests included in every plan.
              </>,
              "No hidden fees or minimum usage, and no credits or top-ups needed.",
              "Free trial for 14 days on all plans. No long-term commitment required.",
            ]}
          />
          <Group
            title="Scalability & Security"
            items={[
              "Enterprise scalability, and industry standard security & encryption.",
              "Always available and hosted in the cloud.",
              "SLA for Enterprise customers.",
            ]}
          />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/features">Discover features</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing-comparison">Pricing Comparison</Link>
          </Button>
        </div>
        <div className="mt-10 space-y-2 text-xs text-muted-foreground">
          <p>
            * Paid-for requests are those that are in excess of free requests included in monthly
            plans. Plans are billed monthly in arrears, at the end of each billing period.
            Cancelling stops future renewals, but the charge for the billing period you&apos;re in
            still applies.
          </p>
          <p>
            ** Prices are exclusive of VAT. See{" "}
            <Link href="/terms" className="underline">
              here for full terms and conditions, including cancellation terms.
            </Link>
          </p>
        </div>
      </Section>

      <Section id="eiscd">
        <div className="mx-auto max-w-3xl">
          <EiscdProduct showLinkToFeatures />
        </div>
      </Section>

      <Section id="contact" tone="muted">
        <Enquiry product="api" />
      </Section>
    </>
  );
}
