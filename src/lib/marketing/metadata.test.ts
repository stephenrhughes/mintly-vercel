import { describe, expect, it } from "vitest";

import { canonicalUrl, pageMetadata, routeMetadata } from "./metadata";
import { EISCD_OG_IMAGE } from "./routes";

// Ported from mintly-web seo.test.js (WEB-02).
describe("page metadata", () => {
  it("uses the old title as is, with canonical and alternates on www", () => {
    const meta = routeMetadata("/pricing");
    expect(meta.title).toEqual({
      absolute: "Pricing - Bank Account Checker from 0.8p / check - Mintly",
    });
    expect(meta.alternates?.canonical).toBe("https://www.mintly.uk/pricing");
    expect(meta.alternates?.languages).toEqual({
      "en-GB": "https://www.mintly.uk/pricing",
      "en-IE": "https://www.mintly.uk/pricing",
      "x-default": "https://www.mintly.uk/pricing",
    });
  });

  it("gives the home page a trailing slash, as the old canonical did", () => {
    expect(canonicalUrl("/")).toBe("https://www.mintly.uk/");
  });

  it("sends Open Graph and the Twitter large card with the default image", () => {
    const meta = routeMetadata("/features");
    expect(meta.openGraph).toMatchObject({
      url: "https://www.mintly.uk/features",
      siteName: "Mintly",
      images: ["https://www.mintly.uk/assets/img/brand/bac-og-image.webp"],
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("uses a page's own image, such as the EISCD one", () => {
    expect(routeMetadata("/eiscd").openGraph?.images).toEqual([canonicalUrl(EISCD_OG_IMAGE)]);
  });

  it("marks hidden pages noindex", () => {
    expect(routeMetadata("/links").robots).toEqual({ index: false, follow: false });
    expect(routeMetadata("/pricing").robots).toBeUndefined();
  });

  it("can mark a page as an article", () => {
    const meta = pageMetadata({ path: "/x", title: "X", description: "Y", type: "article" });
    expect(meta.openGraph).toMatchObject({ type: "article" });
  });
});
