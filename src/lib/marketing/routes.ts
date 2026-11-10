// Every public page on the sales site (WEB-01, WEB-03). The sitemap, the
// footer, breadcrumbs, the article and guide listings and the sitemap
// parity test all read this list, so a page that isn't here isn't
// discoverable. Titles and descriptions are the ones the old site used,
// kept word for word so search rankings hold (plan §6.10).

export type RouteSection =
  "home" | "product" | "pricing" | "developers" | "company" | "articles" | "guides" | "legal";

export type SiteRoute = {
  path: string;
  /** Short name for menus, breadcrumbs and listings. */
  label: string;
  /** The full <title>, used as is (no "| Mintly" template). */
  title: string;
  description: string;
  section: RouteSection;
  /** ISO date the content last changed, for the sitemap. */
  lastModified: string;
  /** Left out of the sitemap and marked noindex (the old /links page). */
  hidden?: boolean;
  /** Open Graph image, when not the default. */
  image?: string;
};

export const DEFAULT_OG_IMAGE = "/assets/img/brand/bac-og-image.webp";
export const EISCD_OG_IMAGE = "/assets/img/brand/eiscd-og-image.webp";

export const siteRoutes: SiteRoute[] = [
  {
    path: "/",
    label: "Home",
    title: "UK Bank Account Validation API & Tools. From 0.8p / check.",
    description:
      "Mintly helps you check bank account data is valid. Easy to use tools for teams, or integrate with our APIs. Validate bank accounts and IBAN easily with Mintly",
    section: "home",
    lastModified: "2026-07-15",
  },
  {
    path: "/features",
    label: "Bank Account Checker API & Web",
    title: "Bank Account Validation Features - API & Web Tools | Mintly",
    description:
      "Explore Mintly's bank validation features: RESTful API, web tools, team collaboration, 99.95% uptime. UK, Ireland & global IBAN support. 14-day free trial.",
    section: "product",
    lastModified: "2025-12-16",
  },
  {
    path: "/bank-account-validation-api",
    label: "Bank Account Validation API",
    title: "UK Bank Account Validation API, Real-Time, From 0.8p | Mintly",
    description:
      "Validate UK sort codes, account numbers, and IBANs via REST API. 100% UK bank coverage, <50ms response, VocaLink authorised, from £37/month. Free 14-day trial.",
    section: "product",
    lastModified: "2026-06-23",
  },
  {
    path: "/sort-code-checker",
    label: "Free Sort Code Checker",
    title: "Free UK Sort Code Checker & Bank Account Validator - Mintly",
    description:
      "Instantly validate UK & Irish sort codes and bank account numbers. Free sort code lookup for bank details. 10 free checks/week. Covers 100% of UK banks.",
    section: "product",
    lastModified: "2026-07-05",
  },
  {
    path: "/eiscd",
    label: "EISCD Data File",
    title: "EISCD Data File - Extended Industry Sort Code Directory - Mintly",
    description:
      "License the EISCD - the authoritative UK sort code database - for your whole organisation. One flat annual fee, delivered as CSV, TXT, XML or XLSX. Official authorized distributor.",
    section: "product",
    lastModified: "2026-04-17",
    image: EISCD_OG_IMAGE,
  },
  {
    path: "/eiscd-api",
    label: "EISCD API",
    // The old title said £2069; the price is £2,130 a year (plans.ts).
    title: "EISCD UK Sort Code Data via REST API - Only £2130 / year",
    description:
      "Access the full EISCD via a REST API. Download 20,000+ UK sort codes in TXT, CSV, XML or XLSX, or pull weekly deltas. VocaLink authorised distributor.",
    section: "product",
    lastModified: "2026-07-02",
    image: EISCD_OG_IMAGE,
  },
  {
    path: "/ai-agents",
    label: "AI Agents & MCP",
    title: "Connect AI Agents to UK Bank Validation - AI Ready | Mintly",
    description:
      "Give Claude, coding agents, and any MCP-compatible AI system real-time UK bank account validation. Free MCP server guide and downloadable Agent Skill.",
    section: "product",
    lastModified: "2026-07-06",
  },
  {
    path: "/pricing",
    label: "Pricing",
    title: "Pricing - Bank Account Checker from 0.8p / check - Mintly",
    description:
      "Bank account validation API from £37/month. 14-day free trial. No credit card required. Best value bank account validation in the UK.",
    section: "pricing",
    lastModified: "2026-07-15",
  },
  {
    path: "/pricing-calculator",
    label: "Price Calculator",
    title: "API Price Calculator - Work Out Your Monthly Cost | Mintly",
    description:
      "Enter your expected monthly bank account checks and see which Mintly plan is cheapest, including volume pricing and the EISCD licence. No sign-up needed.",
    section: "pricing",
    lastModified: "2026-08-24",
  },
  {
    path: "/pricing-comparison",
    label: "Pricing Comparison",
    title: "Bank Account & Sort Code Validation Prices Compared | Mintly",
    description:
      "Compare Mintly's pricing for UK bank account and sort code validation against esortcode, postcoder.com, and loqate. The best per-check value for Enterprise.",
    section: "pricing",
    lastModified: "2026-07-15",
  },
  {
    path: "/get-started",
    label: "Getting Started",
    title: "Get Started with Mintly - Bank Account Validation API & Tools",
    description:
      "Start validating UK bank accounts in minutes. Choose between our powerful API for developers or easy-to-use web tools for teams. Free trial available.",
    section: "developers",
    lastModified: "2025-12-16",
  },
  {
    path: "/docs",
    label: "API Documentation",
    title: "Mintly API Reference - UK Bank Account Validation Docs",
    description:
      "Mintly API Reference documents. Find out how easy our APIs are to use, helping you check bank account numbers automatically.",
    section: "developers",
    lastModified: "2026-06-02",
  },
  {
    path: "/eiscd-docs",
    label: "EISCD API Documentation",
    title: "Mintly EISCD API Reference - EISCD Data File API Docs",
    description:
      "Mintly EISCD API Reference documents. Find out how easy our APIs are to use, helping you obtain the EISCD through a RESTful API.",
    section: "developers",
    lastModified: "2026-09-08",
    image: EISCD_OG_IMAGE,
  },
  {
    path: "/eiscd-docs/weekly/v1",
    label: "EISCD API v1 Documentation",
    title: "Mintly EISCD API v1 Reference - Legacy EISCD API Docs",
    description:
      "Reference for version 1 of the Mintly EISCD API, still available and unchanged for existing integrations. Version 2 is the current release.",
    section: "developers",
    lastModified: "2026-09-08",
    image: EISCD_OG_IMAGE,
  },
  {
    path: "/eiscd-docs/monthly/v2",
    label: "Monthly EISCD API Documentation",
    title: "Mintly Monthly EISCD API Reference - EISCD Data File API Docs",
    description:
      "Mintly monthly EISCD API Reference documents. Download the complete Extended Industry Sort Code Directory through a RESTful API on a monthly plan.",
    section: "developers",
    lastModified: "2026-09-08",
    image: EISCD_OG_IMAGE,
  },
  {
    path: "/integration-guides",
    label: "Integration Guides",
    title: "Mintly Integration Guides: Connect Mintly with anything",
    description:
      "Find a guide about connecting Mintly to your own system for automating sort code & bank account checks.",
    section: "developers",
    lastModified: "2026-06-02",
  },
  {
    path: "/release-notes",
    label: "Release Notes",
    title: "Release Notes - Our latest changes and updates explained",
    description:
      "Mintly API Release Notes & Change Log. Keep up to date with changes to our platform for bank account validation.",
    section: "developers",
    lastModified: "2026-05-22",
  },
  {
    path: "/about",
    label: "About Us",
    title: "About Mintly - Our mission and contact info",
    description:
      "About Mintly - founded by a team with 20+ years' experience in finance and Open Banking. Processing over 1 million bank account validations per month.",
    section: "company",
    lastModified: "2026-07-08",
  },
  {
    path: "/faq",
    label: "FAQ & Support",
    title: "Mintly FAQ & Support: your bank account checking questions answered",
    description:
      "Answers about checking sort codes, bank accounts and IBAN with Mintly - plus how to reach our support team by email, phone or live chat.",
    section: "company",
    lastModified: "2026-06-02",
  },
  {
    path: "/articles",
    label: "Articles",
    title: "Mintly Articles: read about bank account checks and more",
    description:
      "Read our useful articles to discover how bank account checking can add value to your business. We make checking bank accounts easy, no matter your scale.",
    section: "company",
    lastModified: "2026-06-29",
  },
  {
    path: "/links",
    label: "Quick Links",
    title: "Mintly Quick Links",
    description: "Mintly. Helping you check bank account numbers, sort codes and IBAN with ease.",
    section: "company",
    lastModified: "2026-06-01",
    hidden: true,
  },
  {
    path: "/terms",
    label: "Terms & Conditions",
    title: "Mintly Terms & Conditions",
    description:
      "Our terms and conditions. Mintly helps you check bank account and sort code numbers, no matter your scale or size.",
    section: "legal",
    lastModified: "2026-03-22",
  },
  {
    path: "/eiscd-terms",
    label: "EISCD Terms & Conditions",
    title: "Mintly EISCD Terms & Conditions",
    description:
      "Our EISCD terms and conditions. Mintly helps you check bank account and sort code numbers, no matter your scale or size.",
    section: "legal",
    lastModified: "2025-11-27",
  },
  {
    path: "/privacy",
    label: "Privacy Policy",
    title: "Mintly Privacy Notice",
    description:
      "Mintly Privacy Notice. Mintly cares deeply about you and your clients security and privacy, we'll never share your data.",
    section: "legal",
    lastModified: "2025-04-30",
  },
  {
    path: "/modern-slavery",
    label: "Modern Slavery",
    title: "Mintly Modern Slavery Notice",
    description:
      "Mintly Modern Slavery Notice. Mintly cares deeply about protecting employees' rights. Read our policy here to see how we tackle modern slavery.",
    section: "legal",
    lastModified: "2024-02-09",
  },
  ...article("gdpr-and-security", "GDPR and Security", "2026-09-09", {
    title: "Bank Account Validation and GDPR: Handling Data Securely | Mintly",
    description:
      "Bank details are sensitive data under UK GDPR. Learn how secure, automated bank account validation reduces breach risk and keeps your firm compliant.",
  }),
  ...article("automation", "Automating Bank Account Checks", "2026-09-09", {
    title: "How to Automate Bank Account Checking with an API | Mintly",
    description:
      "Automate UK bank account and sort code checks with an API. Learn how automated validation cuts errors, saves time and scales to thousands of checks a day.",
  }),
  ...article("bacs-and-direct-debit", "Bacs and Direct Debit", "2026-09-09", {
    title: "Bacs and Direct Debit Explained: Why Data Validation Matters | Mintly",
    description:
      "How do Bacs and Direct Debit work, and why does data validation matter? Learn how validating sort codes and account numbers prevents failed UK payments.",
  }),
  ...article("bank-validation-api", "Bank Validation APIs", "2026-09-09", {
    title: "Bank Validation API: How They Work and Why Companies Use Them | Mintly",
    description:
      "What is a bank account validation API, how does it work, and what should you look for? A practical guide to real-time UK sort code and account validation.",
  }),
  ...article("sortcodes", "UK Sort Codes", "2026-09-09", {
    title: "What Is a UK Sort Code and How Do You Check It? | Mintly",
    description:
      "What is a UK sort code, where do you find it, and how do you validate one? Learn how sort code checking works and how to automate it with an API.",
  }),
  ...article("swift-iban", "SWIFT/BIC and IBAN", "2026-09-09", {
    title: "What Are SWIFT/BIC Codes and IBANs? A Guide to Validation | Mintly",
    description:
      "What are SWIFT/BIC codes and IBANs, and how do you validate them? Learn how international bank codes work and how to check them alongside UK bank accounts.",
  }),
  ...article("auddis", "Pre-AUDDIS Checks", "2026-09-09", {
    title: "Pre-AUDDIS Checks: Validate Direct Debit Details Before Bacs | Mintly",
    description:
      "Reduce Direct Debit rejections with pre-AUDDIS checks. Learn how validating sort codes and account numbers before Bacs submission keeps your mandates clean.",
  }),
  ...article("modulus-checking", "What is Modulus Checking?", "2026-09-09", {
    title: "What Is Modulus Checking? Bank Account Validation Explained | Mintly",
    description:
      "What is modulus checking, how do the Modulus 10 and Modulus 11 algorithms work, and how do you automate it? A clear guide to UK bank account validation.",
  }),
  ...article("reasons", "Why Check Bank Details?", "2026-09-09", {
    title: "Why Check Bank Account Details Before Making Payments? | Mintly",
    description:
      "Why should you validate bank account and sort code details before paying? Learn how bank account validation prevents failed payments, fraud and compliance risk.",
  }),
  ...article(
    "high-volume-bank-account-validation-api",
    "High-Volume Validation API",
    "2026-09-09",
    {
      title: "High-Volume UK Bank Account Validation API For Enterprise | Mintly",
      description:
        "Validate 50,000+ UK bank accounts a month via API. Real-time sort code and modulus checking under 50ms, from 0.8p per check, with bulk CSV and developer guides.",
    },
  ),
  ...article("eiscd-data-file", "The EISCD Data File", "2026-09-09", {
    title: "EISCD Data File: UK Sort Code Directory",
    description:
      "Download the UK Extended Industry Sort Code Directory (EISCD) as a data file. Validate sort codes, prevent payment failures and stay compliant.",
    image: EISCD_OG_IMAGE,
  }),
  ...guide("salesforce-integration", "Salesforce", "2024-09-02", {
    title: "Leverage automation in Salesforce with Mintly Bank Validation tools",
    description:
      "Step by step guide to setting up Salesforce to integrate with Mintly's APIs. Leverage the power of Zapier and Mintly to automate your bank account checks.",
  }),
  ...guide("power-automate-integration", "Power Automate", "2024-09-02", {
    title: "Using Power Automate with Mintly Bank Account Validation tools",
    description:
      "Step by step guide to setting up Power Automate to integrate with Mintly's APIs. Leverage the power of Mintly to automate your bank account checks.",
  }),
  ...guide("nodejs-integration", "Node.js", "2025-04-29", {
    title: "Integrate your Node.js App with Mintly Bank Validation APIs",
    description:
      "Step by step guide to setting up your Node.js app to integrate with Mintly's APIs. Leverage the power of Mintly to automate your bank account checks.",
  }),
  ...guide("python-integration", "Python", "2025-04-29", {
    title: "Integrate your Python App with Mintly Bank Validation APIs",
    description:
      "Step by step guide to setting up your Python app to integrate with Mintly's APIs. Leverage the power of Mintly to automate your bank account checks.",
  }),
  ...guide("csharp-integration", "C# .NET", "2026-06-02", {
    title: "Integrate your C# App with Mintly Bank Validation APIs",
    description:
      "Step by step guide to setting up your C# .NET app to integrate with Mintly's APIs. Leverage the power of Mintly to automate your bank account checks.",
  }),
  ...guide("zapier-integration", "Zapier", "2025-04-29", {
    title: "Integrate A Zapier Workflow with Mintly Bank Validation APIs",
    description:
      "Step by step guide to setting up Zapier to integrate with Mintly's APIs. Leverage the power of Zapier and Mintly to automate your bank account checks.",
  }),
  ...guide("mcp-server-python", "MCP Server (Python)", "2025-06-10", {
    title: "Build a MCP Server: connecting AI Chatbots to the Mintly API",
    description:
      "Step by step guide to setting up an MCP Server to integrate with Mintly's APIs. Leverage the power of Mintly to automate your bank account checks.",
  }),
];

type Copy = { title: string; description: string; image?: string };

function article(slug: string, label: string, lastModified: string, copy: Copy): SiteRoute[] {
  return [{ path: `/articles/${slug}`, label, lastModified, section: "articles", ...copy }];
}

function guide(slug: string, label: string, lastModified: string, copy: Copy): SiteRoute[] {
  return [{ path: `/integration-guides/${slug}`, label, lastModified, section: "guides", ...copy }];
}

const byPath = new Map(siteRoutes.map((route) => [route.path, route]));

/** The registry entry for a path; throws so a typo fails the build. */
export function siteRoute(path: string): SiteRoute {
  const route = byPath.get(path);
  if (!route) throw new Error(`No site route for ${path}`);
  return route;
}

export function routesInSection(section: RouteSection): SiteRoute[] {
  return siteRoutes.filter((route) => route.section === section && !route.hidden);
}

/** The slugs under a prefix, for generateStaticParams. */
export function slugsUnder(prefix: "/articles/" | "/integration-guides/"): string[] {
  return siteRoutes
    .filter((route) => route.path.startsWith(prefix))
    .map((route) => route.path.slice(prefix.length));
}

/** The JSON-LD page facts for a registered route: its name, first published and last changed. */
export function pageInfo(path: string, name: string, published: string) {
  return {
    path,
    title: name,
    published: new Date(`${published}T03:00:00Z`).toISOString(),
    modified: new Date(`${siteRoute(path).lastModified}T03:00:00Z`).toISOString(),
  };
}
