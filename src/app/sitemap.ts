import type { MetadataRoute } from "next";

import { siteRoutes } from "@/lib/marketing/routes";
import { getSiteUrl } from "@/lib/site";

// Built from the route registry, so a new page is listed once it is
// registered (WEB-03). Replaces the old hand-maintained sitemap.xml.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return siteRoutes
    .filter((route) => !route.hidden)
    .map((route) => ({
      url: route.path === "/" ? `${base}/` : `${base}${route.path}`,
      lastModified: route.lastModified,
    }));
}
