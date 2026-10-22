import { describe, expect, it } from "vitest";

import { getDeploymentEnvironment, getSiteUrl, isIndexable } from "./site";

describe("getDeploymentEnvironment", () => {
  it("reads VERCEL_ENV", () => {
    expect(getDeploymentEnvironment({ VERCEL_ENV: "production" })).toBe("production");
    expect(getDeploymentEnvironment({ VERCEL_ENV: "preview" })).toBe("preview");
  });

  it("treats anything else as development", () => {
    expect(getDeploymentEnvironment({})).toBe("development");
    expect(getDeploymentEnvironment({ VERCEL_ENV: "development" })).toBe("development");
    expect(getDeploymentEnvironment({ VERCEL_ENV: "staging" })).toBe("development");
  });
});

describe("getSiteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL and strips trailing slashes", () => {
    expect(
      getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://www.mintly.uk/", VERCEL_URL: "x.vercel.app" }),
    ).toBe("https://www.mintly.uk");
  });

  it("uses the production URL in production", () => {
    expect(
      getSiteUrl({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "mintly.vercel.app",
        VERCEL_URL: "mintly-abc123.vercel.app",
      }),
    ).toBe("https://mintly.vercel.app");
  });

  it("uses the deployment URL on previews", () => {
    expect(getSiteUrl({ VERCEL_ENV: "preview", VERCEL_URL: "mintly-abc123.vercel.app" })).toBe(
      "https://mintly-abc123.vercel.app",
    );
  });

  it("falls back to localhost", () => {
    expect(getSiteUrl({})).toBe("http://localhost:3000");
  });
});

describe("isIndexable", () => {
  it("is true only on production with SITE_INDEXABLE=true", () => {
    expect(isIndexable({ VERCEL_ENV: "production", SITE_INDEXABLE: "true" })).toBe(true);
  });

  it("is false otherwise", () => {
    expect(isIndexable({ VERCEL_ENV: "production" })).toBe(false);
    expect(isIndexable({ VERCEL_ENV: "preview", SITE_INDEXABLE: "true" })).toBe(false);
    expect(isIndexable({ SITE_INDEXABLE: "true" })).toBe(false);
  });
});
