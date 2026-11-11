import { ExternalLink, Mail } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { COMPANY, SALES_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "@/lib/marketing/contact";
import { pageJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/about");

const LINKEDIN = "https://www.linkedin.com/in/stephen-hughes-0839b312/";
const MAPS =
  "https://www.google.co.uk/maps/place/86-90+Paul+St,+London+EC2A+4NE/@51.5256752,-0.0838424,20z/data=!4m6!3m5!1s0x48761ca55fd67523:0x1483f30997bfd8ba!8m2!3d51.5256224!4d-0.0836253!16s%2Fg%2F11f_36vtdg!5m1!1e1?entry=ttu";

const credentials = [
  {
    href: "https://www.vocalink.com",
    image: "/assets/img/theme/vocalink_mastercard.png",
    alt: "Vocalink logo",
    width: 200,
    height: 60,
    text: "Mintly is a VocaLink™ Authorised Distributor of the Extended ISCD, giving us direct access to official UK bank account data sourced from Mastercard's core payment infrastructure.",
  },
  {
    href: "https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/913977660797705",
    image: "/assets/img/theme/CCS_2935_Supplier_AW_300dpi.png",
    alt: "Crown Commercial Service supplier logo",
    width: 140,
    height: 112,
    text: "Mintly is listed on the Crown Commercial Service G-Cloud 14 Lot 2 framework, meaning public sector organisations can procure our services directly without running a separate tender process.",
  },
  {
    href: "https://iasme.co.uk/cyber-essentials/",
    image: "/assets/img/theme/cyberEssentials-1.png",
    alt: "Cyber Essentials badge",
    width: 190,
    height: 75,
    text: "Mintly holds Cyber Essentials certification, the UK government-backed standard that verifies our security controls protect against the most common cyber threats.",
  },
  {
    href: "https://www.cambridgenetwork.co.uk",
    image: "/assets/img/theme/CN_Logo.jpg",
    alt: "Cambridge network logo",
    width: 160,
    height: 80,
    text: "Mintly is a member of Cambridge Network",
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={pageJsonLd(pageInfo("/about", "About Us", "2022-10-05"))} />
      <PageHero compact title="Trust Mintly to help you check bank account data" />

      <Section narrow>
        <h2 className="text-3xl font-semibold tracking-tight">Who we are</h2>
        <div className="mt-4 space-y-4 text-lg text-muted-foreground">
          <p>
            Mintly was founded in 2022 after our team experienced first-hand the damage that failed
            direct debits cause — frustrated customers, lost revenue, and the blame placed on
            outdated, expensive tools that should have caught the problem before it happened.
          </p>
          <p>
            We set out to build a modern alternative: a fast, reliable bank account validation
            service designed around the needs of developers and the businesses they work in. Today,
            Mintly is trusted by 40+ enterprise customers and thousands of businesses using our free
            tools, processing over 1 million account validations per month with 100% uptime over the
            last 100 days.
          </p>
        </div>
      </Section>

      <Section tone="muted">
        <h2 className="text-3xl font-semibold tracking-tight">Our leadership team</h2>
        <div className="mt-8 grid gap-8 rounded-xl border bg-card p-6 shadow-xs sm:p-8 md:grid-cols-[200px_1fr]">
          <a href={LINKEDIN} rel="noopener">
            <Image
              src="/assets/img/theme/profile-sh.png"
              alt="Stephen Hughes"
              width={200}
              height={200}
              className="rounded-full"
            />
          </a>
          <div>
            <h3 className="text-xl font-semibold">Stephen Hughes - Founder &amp; CEO</h3>
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>
                Stephen has over 20 years of experience in software development, spanning financial
                services, government systems, and enterprise technology. Earlier in his career he
                worked on systems built to expose government liability to toxic debt in the wake of
                the 2008 global financial crisis. He then moved into consumer finance, where he led
                teams delivering the first software enabling mortgage lenders to connect to Open
                Banking technology in the UK.
              </p>
              <p>
                It was during this time in finance that the idea for Mintly took shape. Stephen saw
                how critically important it was to validate customer bank details before attempting
                payments — and how the available tools were old, expensive, and hard to integrate.
                He launched Mintly in 2022 to give businesses a modern, developer-friendly
                alternative.
              </p>
            </div>
            <div className="mt-4 flex gap-3">
              <a
                href={LINKEDIN}
                rel="noopener"
                className="inline-flex items-center gap-1 text-sm text-primary"
              >
                LinkedIn <ExternalLink className="size-3.5" aria-hidden />
              </a>
              <a href={`mailto:${SALES_EMAIL}`} aria-label="Email Mintly" className="text-primary">
                <Mail className="size-5" aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </Section>

      <Section narrow>
        <h2 className="text-3xl font-semibold tracking-tight">
          Why choose Mintly as your data validation partner?
        </h2>
        <div className="mt-4 space-y-4 text-muted-foreground">
          <p>
            Our services have been built from the ground up, using the latest cloud technologies.
            This means we can offer highly available, scalable APIs at very competitive prices.
          </p>
          <p>
            We&apos;ve focused on making our tools easy to use, and team friendly, so that your
            business can focus on what you do and you can rely on Mintly to provide fast and
            reliable account checking services.
          </p>
          <p>
            Our OpenAPI 3.0 standards based API is easy for developers to use, and fully documented.
            We have example code to make it super simple to get started.
          </p>
        </div>
        <Button asChild className="mt-6">
          <Link href="/pricing">See pricing plans</Link>
        </Button>
      </Section>

      <Section id="contact" tone="muted">
        <h2 className="text-3xl font-semibold tracking-tight">Get in touch</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-6 text-sm">
            <h3 className="font-semibold">Contact:</h3>
            <p className="mt-2 text-muted-foreground">
              Email us on{" "}
              <a href={`mailto:${SALES_EMAIL}`} className="text-primary underline">
                {SALES_EMAIL}
              </a>{" "}
              or{" "}
              <Link href="/#contact" className="text-primary underline">
                fill in the contact form
              </Link>
            </p>
            <p className="mt-2 text-muted-foreground">
              Call us on{" "}
              <a href={SUPPORT_PHONE_HREF} className="font-semibold text-foreground">
                {SUPPORT_PHONE}
              </a>
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6 text-sm">
            <h3 className="font-semibold">Business hours:</h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground">
              <dt>Weekdays:</dt>
              <dd>9am - 6pm</dd>
              <dt>Weekends:</dt>
              <dd>Closed</dd>
              <dt>Bank holidays:</dt>
              <dd>Closed</dd>
            </dl>
          </div>
          <div className="rounded-xl border bg-card p-6 text-sm">
            <h3 className="font-semibold">Registered Address:</h3>
            <address className="mt-2 text-muted-foreground not-italic">
              {COMPANY.legalName}
              <br />
              86 - 90 Paul Street
              <br />
              London
              <br />
              {COMPANY.postcode}
            </address>
            <a href={MAPS} rel="noopener" className="mt-2 inline-block text-primary underline">
              Google Maps
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              Registered in England &amp; Wales Company Num. {COMPANY.number}.
              <br />
              VAT Registration: {COMPANY.vat}
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <ul className="grid gap-6 sm:grid-cols-2">
          {credentials.map((item) => (
            <li key={item.href} className="flex items-start gap-4 rounded-xl border bg-card p-5">
              <a href={item.href} rel="noopener" className="shrink-0">
                <Image
                  src={item.image}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  className="h-14 w-auto"
                />
              </a>
              <p className="text-sm text-muted-foreground">{item.text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <a
            href="https://www.saashub.com/mintly-bank-account-checker?utm_source=badge&utm_campaign=badge&utm_content=mintly-bank-account-checker&badge_variant=dark&badge_kind=approved"
            rel="noopener"
          >
            <Image
              src="https://cdn-b.saashub.com/img/badges/approved-dark.png?v=1"
              alt="Mintly Bank Account Checker - SaaShub badge"
              width={150}
              height={54}
              unoptimized
            />
          </a>
          <a href="https://saasbrowser.com/en/saas/15811/mintly" rel="noopener">
            <Image
              src="https://static-files.saasbrowser.com/saas-browser-badge-14.svg"
              alt="Mintly Bank Account Checker - SaaS Browser badge"
              width={150}
              height={54}
              unoptimized
            />
          </a>
        </div>
      </Section>
    </>
  );
}
