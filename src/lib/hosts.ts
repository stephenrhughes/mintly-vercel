// The sales site and the app are served by one deployment (requirements
// §15.4, Q11). Routes for the app live under src/app/app/ and are reached in
// one of two ways (APP-12):
//
// - Own host: NEXT_PUBLIC_APP_URL is a bare origin such as
//   https://app.mintly.uk. proxy.ts rewrites app.mintly.uk/tools to the
//   internal /app/tools, so app URLs have no /app prefix (APP-02).
// - Path mode: NEXT_PUBLIC_APP_URL is unset (previews, local development) or
//   ends in /app. The app is served at /app on the same host.

import { getSiteUrl } from "@/lib/site";

type Env = Record<string, string | undefined>;

// Referenced literally so Next.js inlines it into client bundles.
const defaultEnv = (): Env => ({
  ...process.env,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

/** The internal folder that holds the app's routes. */
export const APP_ROUTE_PREFIX = "/app";

function explicitAppUrl(env: Env): URL | null {
  const value = env.NEXT_PUBLIC_APP_URL?.trim();
  return value ? new URL(value.replace(/\/+$/, "")) : null;
}

/** The app host (for example app.mintly.uk), or null in path mode. */
export function getAppHost(env: Env = defaultEnv()): string | null {
  const url = explicitAppUrl(env);
  return url && (url.pathname === "/" || url.pathname === "") ? url.host : null;
}

/** "" when the app has its own host, "/app" in path mode. */
export function getAppBasePath(env: Env = defaultEnv()): string {
  return getAppHost(env) ? "" : APP_ROUTE_PREFIX;
}

/** The public URL of the app, without a trailing slash. */
export function getAppUrl(env: Env = defaultEnv()): string {
  const url = explicitAppUrl(env);
  if (url && getAppHost(env)) return url.origin;
  return `${url ? url.origin : getSiteUrl(env)}${APP_ROUTE_PREFIX}`;
}

/** An app-relative path ("/account") as a link href for this deployment. */
export function appPath(path: string, env: Env = defaultEnv()): string {
  const base = getAppBasePath(env);
  if (path === "/" || path === "") return base || "/";
  return `${base}${path}`;
}

/** An app-relative path as an absolute URL, for emails and auth redirects (APP-04). */
export function appUrl(path: string, env: Env = defaultEnv()): string {
  return `${getAppUrl(env)}${path === "/" ? "" : path}`;
}

/** A link from the sales site to an app page: absolute when the app has its own host. */
export function salesToAppHref(path: string, env: Env = defaultEnv()): string {
  return getAppHost(env) ? appUrl(path, env) : appPath(path, env);
}

// Old portal URLs on www and where they now live in the app (APP-09, plan §8).
const legacyPaths: Record<string, string> = {
  "/dashboard": "/",
  "/tools": "/tools",
  "/monitor": "/usage",
  "/join": "/join",
  "/admin": "/admin",
  "/success": "/welcome",
  "/auth-callback": "/auth/callback",
  "/login": "/sign-in",
  "/sign-in": "/sign-in",
  "/sign-up": "/sign-up",
  "/register": "/sign-up",
  "/forgot-password": "/forgot-password",
};

export type RouteDecision =
  /** An app page. appPathname is app-relative; rewrite is the internal path, if one is needed. */
  | { type: "app"; appPathname: string; rewrite: string | null }
  | { type: "redirect"; location: string; permanent: boolean }
  | { type: "sales" }
  | { type: "not-found" };

function stripAppPrefix(pathname: string): string | null {
  if (pathname === APP_ROUTE_PREFIX) return "/";
  if (pathname.startsWith(`${APP_ROUTE_PREFIX}/`)) return pathname.slice(APP_ROUTE_PREFIX.length);
  return null;
}

/**
 * Decides how proxy.ts handles a request (APP-01, APP-09, APP-12).
 * Redirect locations are absolute when they change host, otherwise paths.
 */
export function routeRequest(
  request: { host: string; pathname: string; search: string },
  env: Env = defaultEnv(),
): RouteDecision {
  const appHost = getAppHost(env);
  const { host, pathname, search } = request;
  const legacy = legacyPaths[pathname.replace(/\/+$/, "") || "/"];
  const inAppFolder = stripAppPrefix(pathname);

  if (appHost) {
    if (host === appHost) {
      // The internal prefix is never a public URL on the app host.
      if (inAppFolder !== null) {
        return { type: "redirect", location: `${inAppFolder}${search}`, permanent: false };
      }
      return {
        type: "app",
        appPathname: pathname,
        rewrite: pathname === "/" ? APP_ROUTE_PREFIX : `${APP_ROUTE_PREFIX}${pathname}`,
      };
    }
    if (legacy) {
      return { type: "redirect", location: appUrl(legacy, env) + search, permanent: true };
    }
    // App routes don't exist on the sales host (APP-01).
    if (inAppFolder !== null) return { type: "not-found" };
    return { type: "sales" };
  }

  if (inAppFolder !== null) return { type: "app", appPathname: inAppFolder, rewrite: null };
  if (legacy) {
    return { type: "redirect", location: appPath(legacy, env) + search, permanent: true };
  }
  return { type: "sales" };
}

// The signed-in sections of the app. These redirect to sign-in without a
// session (plan §6.1: /sign-in?next=…), and are the only places `next` may
// send someone after sign-in (APP-05), so it can't be an open redirect.
// Other app paths (sign-in, sign-up, reset, the auth callback, invites) are
// public, and unknown paths 404 (APP-01).
const signedInSections = [
  "/tools",
  "/usage",
  "/subscription",
  "/subscribe",
  "/billing",
  "/team",
  "/account",
  "/admin",
  "/welcome",
];

function inSection(path: string, section: string): boolean {
  return path === section || path.startsWith(`${section}/`);
}

export function isProtectedAppPath(appPathname: string): boolean {
  return (
    appPathname === "/" ||
    appPathname === "/sign-in/mfa" ||
    signedInSections.some((section) => inSection(appPathname, section))
  );
}

// Public app pages. Together with the signed-in sections these are every
// app route; anything else is a 404 (APP-01). src/lib/hosts.test.ts checks
// this list against the route files.
const publicAppPaths = [
  "/sign-in",
  "/sign-up",
  "/check-email",
  "/forgot-password",
  "/reset-password",
  "/sign-out",
  "/robots.txt",
  "/page-not-found",
];
const publicAppSections = ["/auth", "/join"];

export function isKnownAppPath(appPathname: string): boolean {
  return (
    isProtectedAppPath(appPathname) ||
    publicAppPaths.includes(appPathname) ||
    publicAppSections.some((section) => inSection(appPathname, section))
  );
}

/** Where proxy.ts sends unknown app paths, to render the app's 404 page. */
export const APP_NOT_FOUND_PATH = "/page-not-found";

// Public pages that `next` may also point at.
const publicNextPrefixes = ["/join/", "/reset-password"];

/** Returns `next` if it's an allowed app-relative path, otherwise "/". */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || next.length > 2048) return "/";
  // Reject protocol-relative and backslash tricks before parsing.
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  let url: URL;
  try {
    url = new URL(next, "http://app.invalid");
  } catch {
    return "/";
  }
  if (url.origin !== "http://app.invalid") return "/";
  const path = url.pathname;
  const allowed =
    path === "/" ||
    signedInSections.some((section) => inSection(path, section)) ||
    publicNextPrefixes.some((prefix) =>
      prefix.endsWith("/")
        ? path.startsWith(prefix) && path.length > prefix.length
        : inSection(path, prefix),
    );
  return allowed ? `${path}${url.search}` : "/";
}
