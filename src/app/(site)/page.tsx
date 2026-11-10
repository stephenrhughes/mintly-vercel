import {
  Code2,
  CreditCard,
  Globe2,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { CheckList } from "@/components/site/check-list";
import { CtaBand } from "@/components/site/cta-band";
import { Enquiry } from "@/components/site/enquiry/enquiry";
import { FeatureGrid } from "@/components/site/feature-grid";
import { FreeChecker } from "@/components/site/free-checker/free-checker";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { StepsHowTo } from "@/components/site/steps-how-to";
import { Testimonials } from "@/components/site/testimonials";
import { Button } from "@/components/ui/button";
import { faqJsonLd, fullJsonLd, HOME_FAQ } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/");

const stats = [
  { value: "20M+", label: "Accounts checked" },
  { value: "99.95%", label: "Service Uptime" },
  { value: "<50ms", label: "Super Fast" },
];

const benefits = [
  {
    icon: PiggyBank,
    title: "Lower Your Costs",
    text: "Reduce failed payments by up to 90%. Save time & money every month.",
    tags: ["All UK Banks", "IBAN supported", "from 0.8p per check"],
  },
  {
    icon: Sparkles,
    title: "Better User Experience",
    text: "Instant feedback means improved customer experience. Get customers paying sooner.",
    tags: ["Super fast", "Real-time checks", "Always available"],
  },
  {
    icon: ShieldCheck,
    title: "Stay Compliant",
    text: "Meet your BACS requirements for data validation. Weekly data updates ensure accuracy.",
    tags: ["GDPR compliant", "Cyber Essentials", "Official Data"],
  },
];

const features = [
  {
    icon: Landmark,
    title: "UK & Ireland Coverage",
    text: "Validate all UK and Ireland bank accounts, building societies, and credit unions. Weekly data updates ensure accuracy.",
  },
  {
    icon: ShieldCheck,
    title: "Modulus Checking",
    text: "Advanced modulus 10 and 11 algorithms verify account number validity against the latest BACS specifications.",
  },
  {
    icon: CreditCard,
    title: "Payment Type Detection",
    text: "Know which payment methods each account supports: BACS, CHAPS, Faster Payments, Direct Debit, and more.",
  },
  {
    icon: Globe2,
    title: "Global IBAN Validation",
    text: "Validate IBAN for all participating countries worldwide. Support for 89 countries.",
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={[
          fullJsonLd(pageInfo("/", "Home", "2022-10-08")),
          faqJsonLd("#homepage-faq", HOME_FAQ),
        ]}
      />
      <PageHero
        title={
          <>
            Bank Account Validation from <span className="text-brand-mint">0.8p</span> Per Check
          </>
        }
        lead={
          <h2 className="text-lg font-normal">
            Modulus checking APIs for UK businesses. No setup fees, no top-ups. Live in minutes.
          </h2>
        }
        actions={
          <>
            <Button
              asChild
              size="lg"
              className="bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
            >
              <Link href="/pricing">Pricing</Link>
            </Button>
            <BookDemoButton label="Book a call" size="lg" variant="onDark" />
          </>
        }
        aside={
          <Image
            src="/assets/img/brand/mintly-sample.png"
            alt="Mintly checks sort codes and bank accounts are valid"
            width={1200}
            height={800}
            priority
            sizes="(min-width: 1024px) 480px, 100vw"
            className="h-auto w-full rounded-xl shadow-2xl"
          />
        }
      >
        <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
              <dd className="text-2xl font-semibold">{stat.value}</dd>
              <dt className="mt-1 text-xs text-white/70">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </PageHero>

      <Section>
        <FeatureGrid features={benefits} />
      </Section>

      <Section tone="muted">
        <SectionHeading
          align="center"
          title="Trusted by businesses across the UK"
          lead="See what our customers say about Mintly's bank validation services."
        />
        <Testimonials />
      </Section>

      <Section id="tryIt">
        <SectionHeading
          align="center"
          title="Try it yourself"
          lead="See Mintly in action - validate a UK bank account for free, no registration required."
        />
        <div className="mx-auto mt-10 max-w-2xl">
          <FreeChecker />
        </div>
        <div className="mt-16">
          <StepsHowTo />
        </div>
      </Section>

      <Section tone="navy">
        <SectionHeading
          align="center"
          invert
          title="Built for developers and business teams alike"
          lead="Whether you need API integration or easy-to-use web tools, Mintly has you covered."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
            <Code2 className="size-6 text-brand-mint" aria-hidden />
            <h3 className="mt-4 text-sm font-semibold tracking-wide text-brand-mint uppercase">
              For Developers
            </h3>
            <h4 className="mt-1 text-xl font-semibold">RESTful API Integration</h4>
            <p className="mt-3 text-white/80">
              Modern OpenAPI 3.0 specification with comprehensive documentation. Get started in
              minutes with code examples in Node.js, Python, PHP, and more.
            </p>
            <CheckList
              invert
              className="mt-4 text-white/90"
              items={[
                "OpenAPI 3.0 specification",
                "Multi-language examples",
                "99.95% uptime SLA for Enterprise Plans",
                <Link key="mcp" href="/ai-agents" className="underline underline-offset-2">
                  MCP Server compatible for AI integration
                </Link>,
                <Link key="skill" href="/ai-agents" className="underline underline-offset-2">
                  Claude Code skill for agentic coding
                </Link>,
              ]}
            />
            <Button asChild className="mt-6 bg-brand-mint text-brand-navy hover:bg-brand-mint/90">
              <Link href="/docs">View API Docs</Link>
            </Button>
          </div>
          <div className="rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
            <LayoutDashboard className="size-6 text-brand-mint" aria-hidden />
            <h3 className="mt-4 text-sm font-semibold tracking-wide text-brand-mint uppercase">
              For Business Teams
            </h3>
            <h4 className="mt-1 text-xl font-semibold">Easy-to-Use Web Portal</h4>
            <p className="mt-3 text-white/80">
              No technical knowledge required. Simply log in and start validating bank accounts,
              IBANs, and SWIFT codes through our intuitive interface.
            </p>
            <CheckList
              invert
              className="mt-4 text-white/90"
              items={[
                "Single or bulk validation",
                "CSV upload & export",
                "Team collaboration features",
                "Usage analytics dashboard",
              ]}
            />
            <Button
              asChild
              variant="outline"
              className="mt-6 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/features#help">Watch Video Tour</Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading align="center" title="Everything you need for bank account validation" />
        <FeatureGrid features={features} columns={4} />
        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link href="/features">View All Features</Link>
          </Button>
        </div>
      </Section>

      <Section tone="mint">
        <SectionHeading
          align="center"
          title="Simple, transparent pricing"
          lead="Try Mintly free for 14 days. No credit card required. No commitment."
        />
        <div className="mx-auto mt-10 max-w-xl rounded-xl border bg-card p-8 shadow-sm">
          <h3 className="text-xl font-semibold">Start Your Free Trial Today</h3>
          <CheckList
            className="mt-4"
            items={[
              "14-day free trial, no credit card required",
              "Evaluation of our tools and API",
              "Cancel anytime, no contracts",
              "Best value paid plans in the UK, from 0.8p per check",
            ]}
          />
          <Button asChild className="mt-6 w-full">
            <Link href="/pricing">View Pricing Plans</Link>
          </Button>
        </div>
      </Section>

      <CtaBand
        title="Ready to eliminate failed payments?"
        lead="Join hundreds of businesses saving thousands on payment errors. Start your free 14-day trial today."
      />

      <Section id="contact" tone="muted">
        <Enquiry />
      </Section>
    </>
  );
}
