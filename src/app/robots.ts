import type { MetadataRoute } from "next";

import { getSiteUrl, isIndexable } from "@/lib/site";

// Ported from mintly-web public/robots.txt, with the same blocks for the
// search and AI crawlers. The old file disallowed /assets/swagger.*, which
// is what /docs loads, so that rule is dropped. The app lives on its own
// host with its own robots.txt (APP-10); /app/ covers path mode.
const disallow = ["/app/", "/admin/", "/api/", "/links"];

const aiCrawlers = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "PerplexityBot",
  "CCBot",
  "cohere-ai",
  "FacebookBot",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  // Crawling stays allowed when not indexable, so crawlers can see the
  // noindex header and meta tag rather than indexing URLs blindly.
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: "bingbot", allow: "/", disallow },
      { userAgent: aiCrawlers, allow: ["/", "/llms.txt"], disallow },
    ],
    sitemap: isIndexable() ? `${getSiteUrl()}/sitemap.xml` : undefined,
  };
}
