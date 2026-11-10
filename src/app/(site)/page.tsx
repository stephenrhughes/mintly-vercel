import { ArrowRight, Building2, Gauge, Landmark, ShieldCheck, Users, Zap } from "lucide-react";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/lib/site";

const stats = [
  { value: "20M+", label: "Accounts checked" },
  { value: "99.95%", label: "Service uptime" },
  { value: "<50ms", label: "Response time" },
];

const products = [
  {
    icon: Landmark,
    title: "Bank Account Checker",
    description:
      "Validate sort codes and account numbers with full modulus checking, plus IBAN and SWIFT/BIC lookups. Use the API, or check single accounts and bulk files in the web tools.",
    points: ["Sort code and account", "IBAN", "SWIFT/BIC", "Bulk checks"],
  },
  {
    icon: Building2,
    title: "EISCD data file and API",
    description:
      "The Extended Industry Sort Code Directory, the UK's sort code reference data, as weekly or monthly files or through an API.",
    points: ["Weekly or monthly", "Full file or deltas", "Text, CSV, XML"],
  },
];

const reasons = [
  {
    icon: Zap,
    title: "Live in minutes",
    description: "Sign up, get a key and make your first call. No setup fees and no top-ups.",
  },
  {
    icon: Gauge,
    title: "From 0.8p per check",
    description: "Simple monthly plans that grow with you, with a 14-day free trial.",
  },
  {
    icon: Users,
    title: "Built for teams",
    description: "Share one subscription with your colleagues, with seats included in every plan.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    description:
      "A sandbox to build against before you go live, and single sign-on for enterprise teams.",
  },
];

const sampleRequest = `BASE=${siteConfig.sandboxBaseUrl}/bankAccount/v1
curl -H "x-api-key: $MINTLY_API_KEY" \\
  $BASE/sortcode/424242/account/42424242`;

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-brand-navy text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-28">
            <div>
              <Badge className="mb-6 border-brand-mint/40 bg-brand-mint/15 text-brand-mint">
                UK bank account validation
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Bank account validation from <span className="text-brand-mint">0.8p</span> per check
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/80">
                Modulus checking APIs for UK businesses. No setup fees, no top-ups. Live in minutes.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
                >
                  <a href="#products">
                    Explore products <ArrowRight />
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <a href={`mailto:${siteConfig.supportEmail}`}>Talk to us</a>
                </Button>
              </div>
              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
                    <dt className="text-xs text-white/70">{stat.label}</dt>
                    <dd className="mt-1 text-2xl font-semibold">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div
              id="developers"
              className="scroll-mt-24 overflow-hidden rounded-xl bg-brand-navy-deep ring-1 ring-white/10"
            >
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs text-white/60">
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="ml-2">Try it against the sandbox</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-white/90 sm:text-sm">
                <code>{sampleRequest}</code>
              </pre>
              <pre className="overflow-x-auto border-t border-white/10 p-5 font-mono text-xs leading-relaxed text-brand-mint sm:text-sm">
                <code>{`HTTP/1.1 200 OK
{ "ModulusCheckCompleted": true, ... }`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section id="products" className="scroll-mt-16 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">Products</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Two APIs that keep your payments data right first time.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {products.map((product) => (
                <Card key={product.title}>
                  <CardHeader>
                    <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                      <product.icon className="size-5" aria-hidden />
                    </div>
                    <CardTitle className="text-xl">{product.title}</CardTitle>
                    <CardDescription className="text-base">{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {product.points.map((point) => (
                      <Badge key={point} variant="secondary">
                        {point}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="why-mintly" className="scroll-mt-16 bg-muted py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">Why Mintly</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {reasons.map((reason) => (
                <div key={reason.title}>
                  <reason.icon className="size-6 text-primary" aria-hidden />
                  <h3 className="mt-4 font-semibold">{reason.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{reason.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
