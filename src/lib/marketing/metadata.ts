// Per-page SEO for the sales site (WEB-02), ported from mintly-web
// src/components/seo.js: the title as the old site had it, description,
// canonical on www.mintly.uk, Open Graph, the Twitter large card and the
// en-GB / en-IE / x-default alternates.

import type { Metadata } from "next";

import { DEFAULT_OG_IMAGE, siteRoute, type SiteRoute } from "@/lib/marketing/routes";
import { siteConfig } from "@/lib/site";

export type PageSeo = Pick<SiteRoute, "path" | "title" | "description"> & {
  image?: string;
  type?: "website" | "article";
  hidden?: boolean;
};

/** An absolute URL on the canonical site. */
export function canonicalUrl(path: string): string {
  return path === "/" ? `${siteConfig.canonicalUrl}/` : `${siteConfig.canonicalUrl}${path}`;
}

export function pageMetadata(page: PageSeo): Metadata {
  const url = canonicalUrl(page.path);
  const image = canonicalUrl(page.image ?? DEFAULT_OG_IMAGE);
  return {
    // The old titles already end in "| Mintly" or similar, so skip the template.
    title: { absolute: page.title },
    description: page.description,
    alternates: {
      canonical: url,
      languages: { "en-GB": url, "en-IE": url, "x-default": url },
    },
    openGraph: {
      url,
      type: page.type ?? "website",
      title: page.title,
      description: page.description,
      siteName: siteConfig.name,
      images: [image],
      locale: "en_GB",
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [image],
    },
    ...(page.hidden ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Metadata for a registered route. */
export function routeMetadata(path: string, type: "website" | "article" = "website"): Metadata {
  return pageMetadata({ ...siteRoute(path), type });
}
