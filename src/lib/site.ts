// Site-wide settings that depend on the deployment environment.

export type DeploymentEnvironment = "production" | "preview" | "development";

type Env = Record<string, string | undefined>;

export const siteConfig = {
  name: "Mintly",
  description:
    "Bank account, sort code, IBAN and SWIFT validation APIs for UK businesses. No setup fees, no top-ups. Live in minutes.",
  supportEmail: "info@mintly.uk",
  apiBaseUrl: "https://api.mintly.uk",
  sandboxBaseUrl: "https://sandbox.mintly.uk",
} as const;

/** Vercel sets VERCEL_ENV; anything else (local, CI) counts as development. */
export function getDeploymentEnvironment(env: Env = process.env): DeploymentEnvironment {
  const value = env.VERCEL_ENV;
  return value === "production" || value === "preview" ? value : "development";
}

/**
 * The public URL of this deployment, without a trailing slash.
 * NEXT_PUBLIC_SITE_URL wins; otherwise Vercel's production or deployment URL.
 */
export function getSiteUrl(env: Env = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const host =
    getDeploymentEnvironment(env) === "production"
      ? env.VERCEL_PROJECT_PRODUCTION_URL
      : env.VERCEL_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}

/**
 * Whether search engines may index this deployment. Off everywhere until
 * SITE_INDEXABLE=true is set on production at cut-over (plan §10.2), so the
 * new app never competes with www.mintly.uk in search results.
 */
export function isIndexable(env: Env = process.env): boolean {
  return getDeploymentEnvironment(env) === "production" && env.SITE_INDEXABLE === "true";
}
