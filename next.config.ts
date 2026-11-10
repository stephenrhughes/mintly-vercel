import createMDX from "@next/mdx";
import type { NextConfig } from "next";

import { securityHeaderRules } from "./src/lib/csp";
import { siteRedirects } from "./src/lib/marketing/redirects";
import { isIndexable } from "./src/lib/site";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Articles, integration guides, release notes and legal pages are MDX
  // (plan §6.10); they are imported by their routes, not routed by file.
  pageExtensions: ["ts", "tsx", "mdx"],
  images: {
    minimumCacheTTL: 86400,
    // The review badges on /about.
    remotePatterns: [
      { protocol: "https", hostname: "cdn-b.saashub.com", pathname: "/img/badges/**" },
      { protocol: "https", hostname: "static-files.saasbrowser.com", pathname: "/**" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Security headers and CSP on every response (WEB-04, APP-10).
  async headers() {
    const extra = isIndexable() ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return securityHeaderRules(process.env, extra);
  },
  // Old sales-site URLs (WEB-03). These run before proxy.ts.
  async redirects() {
    return siteRedirects.map((redirect) => ({ ...redirect, permanent: true }));
  },
};

// Under Turbopack, remark and rehype plugins are named by string with
// serialisable options (node_modules/next/dist/docs/01-app/02-guides/mdx.md).
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: [
      "rehype-slug",
      ["rehype-pretty-code", { theme: "github-dark-dimmed", keepBackground: true }],
    ],
  },
});

export default withMDX(nextConfig);
