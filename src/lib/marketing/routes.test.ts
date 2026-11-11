import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { routeRequest } from "@/lib/hosts";
import { LEGACY_SITEMAP_PATHS } from "@/lib/marketing/legacy-sitemap";
import { siteRedirects } from "@/lib/marketing/redirects";
import { siteRoutes } from "@/lib/marketing/routes";

const site = join(process.cwd(), "src", "app", "(site)");
const content = join(process.cwd(), "src", "content");

/** Where the page for a registered path is rendered from. */
function sourceFor(path: string): string | null {
  const article = path.match(/^\/articles\/([^/]+)$/);
  if (article) return join(content, "articles", `${article[1]}.mdx`);
  const guide = path.match(/^\/integration-guides\/([^/]+)$/);
  if (guide) return join(content, "integration-guides", `${guide[1]}.mdx`);
  if (/^\/eiscd-docs\/[^/]+\/[^/]+$/.test(path)) {
    return join(site, "eiscd-docs", "[frequency]", "[version]", "page.tsx");
  }
  return join(site, path === "/" ? "" : path, "page.tsx");
}

describe("sitemap parity (WEB-03)", () => {
  it("keeps every URL from the old sitemap", () => {
    const registered = new Set(siteRoutes.map((route) => route.path));
    const missing = LEGACY_SITEMAP_PATHS.filter((path) => !registered.has(path));
    expect(missing).toEqual([]);
  });

  it("has a page for every registered route", () => {
    const missing = siteRoutes
      .map((route) => route.path)
      .filter((path) => {
        const source = sourceFor(path);
        return !source || !existsSync(source);
      });
    expect(missing).toEqual([]);
  });

  it("registers every sales page in the app directory", () => {
    const registered = new Set(siteRoutes.map((route) => route.path));
    const pages = readdirSync(site, { recursive: true, encoding: "utf8" })
      .filter((file) => /(^|\/)page\.tsx$/.test(file) && !file.includes("["))
      .map((file) => `/${file.replace(/\/?page\.tsx$/, "")}`.replace(/\/$/, "") || "/");
    for (const page of pages) expect(registered.has(page), page).toBe(true);
  });

  it("has one entry per path, each with a title and description", () => {
    const paths = siteRoutes.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const route of siteRoutes) {
      expect(route.title, route.path).not.toBe("");
      expect(route.description.length, route.path).toBeGreaterThan(40);
      expect(route.lastModified, route.path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("leaves every sales path to the sales site, not the app routing", () => {
    for (const { path } of siteRoutes) {
      const decision = routeRequest({ host: "www.mintly.uk", pathname: path, search: "" }, {});
      expect(decision.type, path).toBe("sales");
    }
  });
});

describe("redirects (WEB-03)", () => {
  it("point at registered pages", () => {
    const registered = new Set(siteRoutes.map((route) => route.path));
    for (const { source, destination } of siteRedirects) {
      expect(registered.has(destination), `${source} → ${destination}`).toBe(true);
    }
  });

  it("never redirect a live page away", () => {
    const registered = new Set(siteRoutes.map((route) => route.path));
    for (const { source } of siteRedirects) expect(registered.has(source), source).toBe(false);
  });

  it("carries over all 31 old redirects", () => {
    expect(siteRedirects).toHaveLength(31);
    expect(new Set(siteRedirects.map((r) => r.source)).size).toBe(31);
  });
});
