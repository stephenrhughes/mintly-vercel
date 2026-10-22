import type { MetadataRoute } from "next";

import { getSiteUrl, isIndexable } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Crawling stays allowed when not indexable, so crawlers can see the
  // noindex header and meta tag rather than indexing URLs blindly.
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/admin/", "/api/"],
    },
    sitemap: isIndexable() ? `${getSiteUrl()}/sitemap.xml` : undefined,
  };
}
