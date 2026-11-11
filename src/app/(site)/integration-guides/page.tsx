import type { Metadata } from "next";
import Link from "next/link";

import { Enquiry } from "@/components/site/enquiry/enquiry";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section } from "@/components/site/section";
import { GUIDE_CARDS } from "@/content/articles";
import { pageJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/integration-guides");

export default function IntegrationGuidesPage() {
  return (
    <>
      <JsonLd
        data={pageJsonLd(pageInfo("/integration-guides", "Integration Guides", "2025-07-30"))}
      />
      <PageHero
        compact
        title="Integrate Mintly into any system with ease"
        lead="Integrate your own system with the Mintly API to begin automating your bank account checks. Pick a guide to get started."
      />
      <Section>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE_CARDS.map((guide) => (
            <li key={guide.href}>
              <Link
                href={guide.href}
                className="block h-full rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary"
              >
                <h2 className="text-lg font-semibold text-primary">{guide.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{guide.description}</p>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-muted-foreground">
          Want to integrate Mintly with a system not listed here?{" "}
          <Link href="/docs" className="text-primary underline">
            Check out our API documentation
          </Link>{" "}
          for more information on how to connect Mintly with any system. Or connect with us using
          the form below and we can help you get started.
        </p>
      </Section>
      <Section id="contact" tone="muted">
        <Enquiry product="api" />
      </Section>
    </>
  );
}
