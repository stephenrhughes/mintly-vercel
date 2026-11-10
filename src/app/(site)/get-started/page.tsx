import {
  Code2,
  Gauge,
  Globe2,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FeatureGrid } from "@/components/site/feature-grid";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { fullJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/get-started");

type Step = { title: string; text: string };

function Path({
  icon: Icon,
  title,
  text,
  tags,
  steps,
  actions,
}: {
  icon: typeof Code2;
  title: string;
  text: string;
  tags: string[];
  steps: Step[];
  actions: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-6 shadow-xs sm:p-8">
      <Icon className="size-7 text-primary" aria-hidden />
      <h3 className="mt-4 text-2xl font-semibold">{title}</h3>
      <p className="mt-3 text-muted-foreground">{text}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li key={tag} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
            {tag}
          </li>
        ))}
      </ul>
      <h4 className="mt-6 font-semibold">Getting Started:</h4>
      <ol className="mt-3 flex-1 space-y-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <span>
              <strong>{step.title}</strong>
              <span className="block text-sm text-muted-foreground">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-3">{actions}</div>
    </div>
  );
}

export default function GetStartedPage() {
  return (
    <>
      <JsonLd
        data={fullJsonLd(pageInfo("/get-started", "Get Started with Mintly", "2022-10-05"))}
      />
      <PageHero
        compact
        title="Get Started with Mintly"
        lead="Choose your path and start validating bank accounts in minutes"
      />

      <Section>
        <SectionHeading
          align="center"
          title="Choose Your Path"
          lead="Whether you're a developer or business user, we've got you covered"
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Path
            icon={Code2}
            title="Developer API"
            text="Integrate bank validation directly into your application with our REST API. Perfect for developers building automated systems."
            tags={["RESTful API", "JSON Responses", "Code Examples"]}
            steps={[
              { title: "Sign up for an account", text: "Choose a plan that fits your needs" },
              { title: "Get your API key", text: "Find it in your dashboard" },
              {
                title: "Follow our integration guides",
                text: "Node.js, Python, Salesforce, MCP examples",
              },
              { title: "Start validating", text: "Go live in minutes" },
            ]}
            actions={
              <>
                <Button asChild>
                  <Link href="/docs">View API Documentation</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/integration-guides">Integration Guides</Link>
                </Button>
              </>
            }
          />
          <Path
            icon={LayoutDashboard}
            title="Web Tools"
            text="Use our secure web portal to validate accounts, upload files, and manage your team. No coding required."
            tags={["Easy to Use", "Bulk Uploads", "Team Access"]}
            steps={[
              { title: "Create your account", text: "Quick signup with secure checkout" },
              { title: "Login to your dashboard", text: "Access all tools instantly" },
              { title: "Start validating", text: "Single checks or bulk file uploads" },
              { title: "Invite your team", text: "Collaborate with teammates" },
            ]}
            actions={
              <>
                <Button asChild>
                  <Link href="/pricing">View Pricing &amp; Sign Up</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/sort-code-checker">Try Free Account Checker</Link>
                </Button>
              </>
            }
          />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          align="center"
          title="What You Get with Every Plan"
          lead="All the features you need to validate bank accounts with confidence"
        />
        <FeatureGrid
          features={[
            {
              icon: Gauge,
              title: "Lightning Fast Validation",
              text: "Sub-50ms response times with 99.95% uptime",
            },
            {
              icon: ShieldCheck,
              title: "Modulus Check Algorithm",
              text: "Catches 95%+ of input errors before they reach the bank",
            },
            {
              icon: Wallet,
              title: "Supported Payment Types",
              text: "20,000+ UK sort codes with accepted payment types",
            },
            {
              icon: Globe2,
              title: "IBAN & BIC/SWIFT Support",
              text: "Validate international bank accounts across 89 countries",
            },
            {
              icon: Users,
              title: "Team Collaboration",
              text: "Invite teammates and manage access with role-based permissions",
            },
            {
              icon: RefreshCw,
              title: "Weekly Updates",
              text: "Always up-to-date with the latest bank branch information",
            },
          ]}
        />
      </Section>

      <section className="bg-brand-navy text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Ready to Get Started?</h2>
          <p className="mt-4 text-lg text-white/80">
            Join thousands of businesses eliminating failed payments with Mintly
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
          >
            <Link href="/pricing">View Pricing Plans</Link>
          </Button>
          <p className="mt-4">
            <Link href="/sort-code-checker" className="text-white/80 underline">
              Or try our free account checker
            </Link>
          </p>
        </div>
      </section>

      <Section>
        <SectionHeading title="Helpful Resources" />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["/docs", "API Documentation", "Complete API reference with examples"],
            [
              "/integration-guides",
              "Integration Guides",
              "Step-by-step tutorials for popular platforms",
            ],
            [
              "/articles/reasons",
              "Why Validate Bank Accounts?",
              "Learn about the cost of failed payments",
            ],
            ["/faq", "FAQs", "Common questions answered"],
          ].map(([href, title, text]) => (
            <li key={href}>
              <Link
                href={href}
                className="block h-full rounded-xl border bg-card p-5 hover:border-primary"
              >
                <strong className="text-primary">{title}</strong>
                <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
