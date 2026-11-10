import { describe, expect, it } from "vitest";

import { EISCD_PLAN, PLANS } from "@/lib/billing/plans";

import {
  articleJsonLd,
  eiscdJsonLd,
  faqJsonLd,
  freeToolsJsonLd,
  fullJsonLd,
  integrationGuideJsonLd,
  type JsonLd,
  pageJsonLd,
  serialiseJsonLd,
} from "./json-ld";

// Ported in spirit from mintly-web StructuredData.test.js (WEB-02).
const page = {
  path: "/features",
  title: "Mintly Features",
  published: "2022-10-05T03:00:00.000Z",
  modified: "2025-12-16T03:00:00.000Z",
};
const nodes = (data: JsonLd) => data["@graph"] as JsonLd[];
const types = (data: JsonLd) => nodes(data).map((node) => node["@type"]);

describe("structured data", () => {
  it("keeps the old node IDs, so search engines see the same graph", () => {
    const graph = nodes(pageJsonLd(page));
    expect(graph.map((n) => n["@id"])).toEqual([
      "https://www.mintly.uk/#features",
      "https://www.mintly.uk/#primaryimage",
      "https://www.mintly.uk/features#breadcrumb",
      "https://www.mintly.uk/#website",
      "https://www.mintly.uk/#organization",
    ]);
  });

  it("adds the product with prices from plans.ts on product pages", () => {
    const app = nodes(fullJsonLd(page)).find((n) => n["@type"] === "SoftwareApplication")!;
    const offers = app.offers as {
      lowPrice: string;
      highPrice: string;
      offers: { price: string }[];
    };
    expect(offers.lowPrice).toBe(PLANS.starter.monthlyPriceGbp.toFixed(2));
    expect(offers.highPrice).toBe(PLANS.professional.monthlyPriceGbp.toFixed(2));
    expect(offers.offers).toHaveLength(3);
  });

  it("prices EISCD at the one figure used across the site", () => {
    const eiscd = nodes(eiscdJsonLd(page)).find(
      (n) => n["@id"] === "https://www.mintly.uk/#eiscd",
    )!;
    expect((eiscd.offers as { price: string }).price).toBe(EISCD_PLAN.annualPriceGbp.toFixed(2));
    expect(JSON.stringify(eiscdJsonLd(page))).not.toContain("2069");
  });

  it("derives the free tool rating from the counts", () => {
    const tool = nodes(freeToolsJsonLd(page)).find(
      (n) => n["@id"] === "https://www.mintly.uk/#free-tools",
    )!;
    expect(tool.aggregateRating).toMatchObject({ ratingValue: "4.71", ratingCount: "51" });
  });

  it("builds articles with an author, a breadcrumb and an optional FAQ", () => {
    const article = articleJsonLd({ ...page, path: "/articles/auddis", title: "Pre-AUDDIS" }, [
      { question: "Q?", answer: "A." },
    ]);
    expect(types(article)).toEqual([
      "Article",
      "ImageObject",
      "BreadcrumbList",
      "WebSite",
      "Organization",
      "FAQPage",
    ]);
    const crumbs = nodes(article)[2].itemListElement as { item: string }[];
    expect(crumbs.map((c) => c.item)).toEqual([
      "https://www.mintly.uk/",
      "https://www.mintly.uk/articles",
      "https://www.mintly.uk/articles/auddis",
    ]);
    expect(types(articleJsonLd({ ...page, path: "/articles/auddis" }))).not.toContain("FAQPage");
  });

  it("files integration guides under their own directory", () => {
    const guide = integrationGuideJsonLd({
      ...page,
      path: "/integration-guides/python-integration",
    });
    expect(JSON.stringify(guide)).toContain(
      "https://www.mintly.uk/integration-guides/python-integration",
    );
  });

  it("gives page FAQs an ID under the site", () => {
    expect(faqJsonLd("#homepage-faq", [])["@id"]).toBe("https://www.mintly.uk/#homepage-faq");
    expect(faqJsonLd("eiscd-api#faq", [])["@id"]).toBe("https://www.mintly.uk/eiscd-api#faq");
  });

  it("escapes < so the script tag can't be closed early", () => {
    expect(serialiseJsonLd({ text: "</script><script>alert(1)</script>" })).not.toContain(
      "</script>",
    );
  });
});
