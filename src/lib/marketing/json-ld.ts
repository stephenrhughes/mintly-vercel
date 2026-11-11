// schema.org structured data for the sales site (WEB-02), ported from
// mintly-web src/components/StructuredData.js. The node IDs and shapes are
// kept as they were, so search engines see the same graph after cut-over.
// Prices now come from plans.ts rather than being typed in here.

import { EISCD_PLAN, PLAN_TIERS, PLANS } from "@/lib/billing/plans";
import {
  COMPANY,
  SALES_EMAIL,
  SOCIAL_LINKS,
  SUPPORT_EMAIL,
  SUPPORT_HOURS_SCHEMA,
  SUPPORT_PHONE_INTL,
} from "@/lib/marketing/contact";

export const SITE = "https://www.mintly.uk";

export type JsonLd = Record<string, unknown>;
export type FaqItem = { question: string; answer: string };

const DEFAULT_DESCRIPTION =
  "Mintly helps you check bank account data is valid. Easy to use tools for teams, or integrate with our APIs. Validate bank accounts and IBAN easily with Mintly";

const website = {
  "@type": "WebSite",
  "@id": `${SITE}/#website`,
  url: `${SITE}/`,
  name: "Mintly",
  description: DEFAULT_DESCRIPTION,
  publisher: { "@id": `${SITE}/#organization` },
  inLanguage: "en-GB",
};

const contactPoint = (contactType: string, email: string) => ({
  "@type": "ContactPoint",
  contactType,
  email,
  telephone: SUPPORT_PHONE_INTL,
  areaServed: "GB",
  availableLanguage: "English",
  hoursAvailable: { "@type": "OpeningHoursSpecification", ...SUPPORT_HOURS_SCHEMA },
});

export const organisation = {
  "@type": "Organization",
  "@id": `${SITE}/#organization`,
  name: "Mintly",
  url: `${SITE}/`,
  address: {
    "@type": "PostalAddress",
    addressLocality: COMPANY.locality,
    addressCountry: COMPANY.country,
    postalCode: COMPANY.postcode,
    streetAddress: COMPANY.street,
  },
  logo: {
    "@type": "ImageObject",
    inLanguage: "en-GB",
    "@id": `${SITE}/#/schema/logo/image/`,
    url: `${SITE}/assets/img/brand/mintly-logo-darker.png`,
    contentUrl: `${SITE}/assets/img/brand/mintly-logo-darker.png`,
    width: 625,
    height: 313,
    caption: "Mintly",
  },
  image: { "@id": `${SITE}/#/schema/logo/image/` },
  contactPoint: [
    contactPoint("customer support", SUPPORT_EMAIL),
    contactPoint("sales", SALES_EMAIL),
  ],
  sameAs: [
    ...SOCIAL_LINKS.map((link) => link.href),
    `https://find-and-update.company-information.service.gov.uk/company/${COMPANY.number}`,
  ],
};

const price = (gbp: number) => gbp.toFixed(2);

function application() {
  const plans = PLAN_TIERS.map((tier) => PLANS[tier]);
  const prices = plans.map((plan) => plan.monthlyPriceGbp);
  return {
    "@type": "SoftwareApplication",
    "@id": `${SITE}/#application`,
    name: "Mintly API",
    description:
      "Mintly's bank account validation API and web tools verify UK sort codes, bank account numbers, IBAN and SWIFT codes in real time. Reduce failed payments and BACS returns with fast, accurate modulus checking for teams and developers.",
    operatingSystem: "Web",
    applicationCategory: "FinanceApplication",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "GBP",
      lowPrice: price(Math.min(...prices)),
      highPrice: price(Math.max(...prices)),
      price: price(Math.min(...prices)),
      offerCount: String(plans.length),
      offers: plans.map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        price: price(plan.monthlyPriceGbp),
        priceCurrency: "GBP",
        url: `${SITE}/pricing`,
      })),
    },
  };
}

const eiscd = {
  "@type": "SoftwareApplication",
  "@id": `${SITE}/#eiscd`,
  name: "EISCD",
  operatingSystem: "ANY",
  applicationCategory: "FinanceApplication",
  offers: {
    "@type": "Offer",
    price: price(EISCD_PLAN.annualPriceGbp),
    priceSpecification: {
      "@type": "PriceSpecification",
      minPrice: price(EISCD_PLAN.annualPriceGbp),
      maxPrice: price(EISCD_PLAN.annualPriceGbp),
      priceCurrency: "GBP",
    },
    priceCurrency: "GBP",
  },
};

// Ratings for the free tools, captured over two months on the old site.
// Keyed by stars so the aggregate is derived rather than hand-calculated.
export const FREE_TOOL_RATING_COUNTS: Record<1 | 2 | 3 | 4 | 5, number> = {
  5: 44,
  4: 4,
  3: 0,
  2: 1,
  1: 2,
};

function freeTools() {
  const entries = Object.entries(FREE_TOOL_RATING_COUNTS);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const average = entries.reduce((sum, [stars, n]) => sum + Number(stars) * n, 0) / total;
  return {
    "@type": "SoftwareApplication",
    "@id": `${SITE}/#free-tools`,
    name: "Mintly Free Sort Code & Bank Account Checker",
    description:
      "Mintly's free tools validate UK and Irish sort codes and bank account numbers, with up to 10 free checks per week.",
    url: `${SITE}/sort-code-checker`,
    operatingSystem: "Web",
    applicationCategory: "FinanceApplication",
    publisher: { "@id": `${SITE}/#organization` },
    offers: { "@type": "Offer", price: "0.00", priceCurrency: "GBP" },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: average.toFixed(2),
      ratingCount: String(total),
      bestRating: "5",
      worstRating: "1",
    },
  };
}

/** The generic questions the home page marks up. */
export const HOME_FAQ: FaqItem[] = [
  {
    question: "How do I check an account number?",
    answer:
      "<p>Using a bank account checker can identify if an account is valid, and the payment types it supports. Mintly's service can be used through a secure website, or via a low-latency API, to add value to your business.</p>",
  },
  {
    question: "How do I check a sort code?",
    answer:
      "<p>Using a sort code checker can identify if it is valid, and the payment types the bank branch supports. Mintly's service can be used through a secure website, or via a low-latency API, to add value to your business.</p>",
  },
  {
    question: "What is a sort code finder?",
    answer:
      "<p>A sort code finder, or sort code lookup tool, is a tool used to find bank branch information from the six-digit sort code. Each sort code identifies one bank branch in the UK and Ireland.</p>",
  },
  {
    question: "How can I automate sort code and bank account checks?",
    answer:
      "<p>You can use a service that offers an Application Programming Interface (API) to help automate sort code and bank account checks. Mintly's API offers a fast, scalable and low cost solution to bank account and sort code checks.</p>",
  },
  {
    question: "How much does automated bank account checking cost?",
    answer:
      "<p>It can cost from as little as 0.8 pence per check with Mintly's online tools or API. We have plans to suit all level of usage, from small businesses to enterprise customers.</p>",
  },
  {
    question: "Is there a free sort code and bank account checking tool?",
    answer:
      "<p>Yes! Mintly has free tools that offer a limited number of sort code and bank account number checks per week.</p>",
  },
  {
    question: "What is a sort code, swift code and IBAN number?",
    answer:
      "<p>Sort codes are numbers used to identify bank branches in the UK and Ireland. Swift codes are used internationally to identify bank branches, while IBAN is an international standard for bank account numbers which many countries use.</p>",
  },
  {
    question: "How can I check bank details?",
    answer:
      "<p>Bank account and sort codes in the UK can be checked using a set of algorithms. Tools like Mintly use these algorithms to check if a bank account is valid or not.</p>",
  },
];

const questions = (items: FaqItem[]) =>
  items.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  }));

/** "/articles/auddis" → "articles/auddis"; "/" → "". */
const slugOf = (path: string) => path.replace(/^\/+/, "");

function breadcrumb(path: string, title: string, directory?: { slug: string; name: string }) {
  const slug = slugOf(path);
  const items: JsonLd[] = [{ "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` }];
  if (directory) {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: directory.name,
      item: `${SITE}/${directory.slug}`,
    });
  }
  if (slug) {
    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name: title,
      item: `${SITE}/${slug}`,
    });
  }
  return { "@type": "BreadcrumbList", "@id": `${SITE}/${slug}#breadcrumb`, itemListElement: items };
}

const primaryImage = {
  "@type": "ImageObject",
  inLanguage: "en-GB",
  "@id": `${SITE}/#primaryimage`,
  url: `${SITE}/assets/img/brand/mintly-sample.png`,
  contentUrl: `${SITE}/assets/img/brand/mintly-sample.png`,
};

const author = {
  "@type": "Person",
  "@id": `${SITE}/#author`,
  name: "Stephen Hughes, Mintly Founder",
  url: SITE,
};

export type PageInfo = {
  path: string;
  title: string;
  published: string;
  modified: string;
};

function webpage({ path, title, published, modified }: PageInfo, type: "WebPage" | "Article") {
  const slug = slugOf(path);
  const isArticle = type === "Article";
  return {
    "@type": type,
    "@id": `${SITE}/#${slug}`,
    url: `${SITE}/${slug}`,
    name: `${title} - Mintly`,
    isPartOf: { "@id": `${SITE}/#website` },
    ...(isArticle ? {} : { primaryImageOfPage: { "@id": `${SITE}/#primaryimage` } }),
    image: { "@id": `${SITE}/#primaryimage` },
    thumbnailUrl: `${SITE}/assets/img/brand/mintly-sample.png`,
    datePublished: published,
    dateModified: modified,
    ...(isArticle ? {} : { breadcrumb: { "@id": `${SITE}/${slug}#breadcrumb` } }),
    inLanguage: "en-GB",
    ...(isArticle ? { headline: title, author, publisher: organisation } : {}),
  };
}

const graph = (...nodes: JsonLd[]): JsonLd => ({
  "@context": "https://schema.org",
  "@graph": nodes,
});

function pageNodes(page: PageInfo) {
  return [
    webpage(page, "WebPage"),
    primaryImage,
    breadcrumb(page.path, page.title),
    website,
    organisation,
  ];
}

/** Content pages that aren't the product: about, legal, listings. */
export function pageJsonLd(page: PageInfo): JsonLd {
  return graph(...pageNodes(page));
}

/** Product and commercial pages: the page graph plus the API product. */
export function fullJsonLd(page: PageInfo): JsonLd {
  return graph(...pageNodes(page), application());
}

/** Pages with the free checker: the full graph plus the rated free tool. */
export function freeToolsJsonLd(page: PageInfo): JsonLd {
  return graph(...pageNodes(page), application(), freeTools());
}

export function eiscdJsonLd(page: PageInfo): JsonLd {
  return graph(...pageNodes(page), eiscd);
}

export type ApiReference = { name: string; version: string; abstract: string; aboutId: string };

export function apiReferenceJsonLd(page: PageInfo, api: ApiReference): JsonLd {
  const slug = slugOf(page.path);
  return graph(...pageNodes(page), {
    "@type": "APIReference",
    "@id": `${SITE}/${slug}#api-reference`,
    name: api.name,
    abstract: api.abstract,
    assemblyVersion: api.version,
    programmingModel: "REST",
    isPartOf: { "@id": `${SITE}/#website` },
    about: { "@id": api.aboutId },
    publisher: { "@id": `${SITE}/#organization` },
    inLanguage: "en-GB",
  });
}

/** An article, with an optional FAQPage for its on-page questions. */
export function articleJsonLd(page: PageInfo, faq?: FaqItem[]): JsonLd {
  const slug = slugOf(page.path).replace(/^articles\//, "");
  const nodes: JsonLd[] = [
    webpage(page, "Article"),
    primaryImage,
    breadcrumb(page.path, page.title, { slug: "articles", name: "articles" }),
    website,
    organisation,
  ];
  if (faq?.length) {
    nodes.push({
      "@type": "FAQPage",
      "@id": `${SITE}/articles/${slug}#faq`,
      mainEntity: questions(faq),
    });
  }
  return graph(...nodes);
}

export function integrationGuideJsonLd(page: PageInfo): JsonLd {
  return graph(
    webpage(page, "Article"),
    primaryImage,
    breadcrumb(page.path, page.title, { slug: "integration-guides", name: "integration-guides" }),
    website,
    organisation,
  );
}

/** The FAQ page marks up the questions it renders. */
export function faqPageJsonLd(published: string, modified: string, items: FaqItem[]): JsonLd {
  return graph(
    {
      "@type": "FAQPage",
      "@id": `${SITE}/#faq`,
      mainEntity: questions(items),
      datePublished: published,
      dateModified: modified,
      isPartOf: { "@id": `${SITE}/#website` },
    },
    breadcrumb("/faq", "FAQ & Support"),
    website,
    organisation,
  );
}

/**
 * A FAQPage for a landing page's own questions. `id` is the part after the
 * site URL, for example "#homepage-faq" or "bank-account-validation-api#faq".
 */
export function faqJsonLd(id: string, items: FaqItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE}/${id}`,
    mainEntity: questions(items),
    isPartOf: { "@id": `${SITE}/#website` },
  };
}

export type HowToStep = { name: string; text: string; url?: string };

export function howToJsonLd(
  name: string,
  description: string,
  steps: HowToStep[],
  totalTime = "PT2M",
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    totalTime,
    tool: { "@type": "HowToTool", name: "Mintly Bank Validation Tool" },
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      url: step.url ?? `${SITE}/sort-code-checker`,
    })),
  };
}

export const howToCheckSortCode = howToJsonLd(
  "How to Check a UK Sort Code",
  "Learn how to validate a UK sort code to find bank details, branch information, and supported payment types. This guide shows you how to use Mintly's free sort code checker.",
  [
    {
      name: "Go to the Sort Code Checker",
      text: "Visit Mintly's free sort code checker at https://www.mintly.uk/sort-code-checker. No registration is required for basic checks.",
    },
    {
      name: "Enter the Sort Code",
      text: "Enter the 6-digit sort code in the format XX-XX-XX (e.g., 20-00-00). The hyphens are optional - you can enter 200000 or 20-00-00.",
    },
    {
      name: "Click Check or Submit",
      text: "Click the 'Check' button to validate the sort code. The validation happens instantly.",
    },
    {
      name: "Review the Results",
      text: "If valid, you'll see the bank name, branch name, branch address, and supported payment types (BACS, CHAPS, Faster Payments, Direct Debit). If invalid, you'll receive an error message.",
    },
  ],
  "PT1M",
);

export const howToCheckBankAccount = howToJsonLd(
  "How to Check a UK Bank Account Number",
  "Learn how to validate a UK bank account number using modulus checking. This guide explains how to verify that a sort code and account number combination is valid.",
  [
    {
      name: "Go to the Bank Account Checker",
      text: "Visit Mintly's free bank account checker at https://www.mintly.uk/sort-code-checker. You can validate up to 10 accounts per week for free.",
    },
    {
      name: "Enter the Sort Code",
      text: "Enter the 6-digit sort code that corresponds to the bank account. The sort code identifies the bank and branch.",
    },
    {
      name: "Enter the Account Number",
      text: "Enter the 8-digit bank account number. UK account numbers are always 8 digits. If your account number has fewer digits, add leading zeros.",
    },
    {
      name: "Click Check to Validate",
      text: "Click the 'Check' button. Mintly uses modulus checking algorithms (the same methods banks use) to verify the account number is mathematically valid for that sort code.",
    },
    {
      name: "Interpret the Results",
      text: "A valid result means the sort code exists and the account number passes modulus checking. You'll see bank details and which payment types the account supports. Note: This confirms the account format is valid, not that the account is active or belongs to a specific person.",
    },
  ],
  "PT2M",
);

/** Serialises JSON-LD for a <script> tag, escaping "<" (Next.js JSON-LD guide). */
export function serialiseJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
