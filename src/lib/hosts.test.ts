import { readdirSync } from "node:fs";
import { dirname, join, sep } from "node:path";

import { describe, expect, it } from "vitest";

import {
  appPath,
  appUrl,
  getAppBasePath,
  getAppUrl,
  isKnownAppPath,
  isProtectedAppPath,
  routeRequest,
  safeNextPath,
  salesToAppHref,
} from "./hosts";

const ownHost = {
  NEXT_PUBLIC_SITE_URL: "https://www.mintly.uk",
  NEXT_PUBLIC_APP_URL: "https://app.mintly.uk",
};
const pathMode = { NEXT_PUBLIC_SITE_URL: "https://preview.vercel.app" };

describe("app URLs", () => {
  it("has no prefix on its own host", () => {
    expect(getAppBasePath(ownHost)).toBe("");
    expect(getAppUrl(ownHost)).toBe("https://app.mintly.uk");
    expect(appPath("/account", ownHost)).toBe("/account");
    expect(appPath("/", ownHost)).toBe("/");
    expect(appUrl("/auth/callback", ownHost)).toBe("https://app.mintly.uk/auth/callback");
    expect(salesToAppHref("/sign-in", ownHost)).toBe("https://app.mintly.uk/sign-in");
  });

  it("is served under /app in path mode (APP-12)", () => {
    expect(getAppBasePath(pathMode)).toBe("/app");
    expect(getAppUrl(pathMode)).toBe("https://preview.vercel.app/app");
    expect(appPath("/account", pathMode)).toBe("/app/account");
    expect(appPath("/", pathMode)).toBe("/app");
    expect(appUrl("/", pathMode)).toBe("https://preview.vercel.app/app");
    expect(salesToAppHref("/sign-in", pathMode)).toBe("/app/sign-in");
  });

  it("uses path mode when NEXT_PUBLIC_APP_URL ends in /app", () => {
    const env = { NEXT_PUBLIC_APP_URL: "http://localhost:3000/app/" };
    expect(getAppBasePath(env)).toBe("/app");
    expect(getAppUrl(env)).toBe("http://localhost:3000/app");
  });
});

describe("routeRequest on separate hosts (APP-01, APP-09)", () => {
  const route = (host: string, pathname: string, search = "") =>
    routeRequest({ host, pathname, search }, ownHost);

  it("rewrites app host paths to the internal app folder", () => {
    expect(route("app.mintly.uk", "/")).toEqual({ type: "app", appPathname: "/", rewrite: "/app" });
    expect(route("app.mintly.uk", "/account")).toEqual({
      type: "app",
      appPathname: "/account",
      rewrite: "/app/account",
    });
  });

  it("sends sales paths on the app host to the app, where they 404", () => {
    expect(route("app.mintly.uk", "/pricing")).toMatchObject({ rewrite: "/app/pricing" });
  });

  it("strips the internal prefix on the app host", () => {
    expect(route("app.mintly.uk", "/app/account", "?a=1")).toEqual({
      type: "redirect",
      location: "/account?a=1",
      permanent: false,
    });
  });

  it("returns 404 for app routes on the sales host", () => {
    expect(route("www.mintly.uk", "/app/account")).toEqual({ type: "not-found" });
    expect(route("www.mintly.uk", "/app")).toEqual({ type: "not-found" });
  });

  it("leaves sales pages alone", () => {
    expect(route("www.mintly.uk", "/")).toEqual({ type: "sales" });
    expect(route("www.mintly.uk", "/pricing")).toEqual({ type: "sales" });
    expect(route("www.mintly.uk", "/apple")).toEqual({ type: "sales" });
  });

  it("redirects old portal URLs to the app host permanently", () => {
    expect(route("www.mintly.uk", "/dashboard")).toEqual({
      type: "redirect",
      location: "https://app.mintly.uk",
      permanent: true,
    });
    expect(route("www.mintly.uk", "/monitor")).toMatchObject({
      location: "https://app.mintly.uk/usage",
    });
    expect(route("www.mintly.uk", "/join", "?invite=abc")).toMatchObject({
      location: "https://app.mintly.uk/join?invite=abc",
    });
    expect(route("www.mintly.uk", "/success")).toMatchObject({
      location: "https://app.mintly.uk/welcome",
    });
    expect(route("www.mintly.uk", "/sign-in/")).toMatchObject({
      location: "https://app.mintly.uk/sign-in",
    });
  });
});

describe("routeRequest in path mode (APP-12)", () => {
  const route = (pathname: string, search = "") =>
    routeRequest({ host: "preview.vercel.app", pathname, search }, pathMode);

  it("serves /app paths directly", () => {
    expect(route("/app")).toEqual({ type: "app", appPathname: "/", rewrite: null });
    expect(route("/app/sign-in")).toEqual({ type: "app", appPathname: "/sign-in", rewrite: null });
  });

  it("redirects old portal URLs under /app", () => {
    expect(route("/dashboard")).toEqual({ type: "redirect", location: "/app", permanent: true });
    expect(route("/tools", "?x=1")).toMatchObject({ location: "/app/tools?x=1" });
  });

  it("leaves sales pages alone", () => {
    expect(route("/")).toEqual({ type: "sales" });
    expect(route("/application")).toEqual({ type: "sales" });
  });
});

describe("isProtectedAppPath", () => {
  it("protects the portal and admin area", () => {
    for (const path of [
      "/",
      "/account",
      "/account/security",
      "/admin",
      "/admin/sso",
      "/sign-in/mfa",
    ]) {
      expect(isProtectedAppPath(path)).toBe(true);
    }
  });

  it("lets the auth pages through, and unknown paths fall to a 404 (APP-01)", () => {
    for (const path of [
      "/sign-in",
      "/sign-up",
      "/forgot-password",
      "/reset-password",
      "/auth/callback",
      "/join/abc",
      "/pricing",
      "/accounts",
    ]) {
      expect(isProtectedAppPath(path)).toBe(false);
    }
  });
});

describe("safeNextPath (APP-05)", () => {
  it("allows app-relative paths in the allow-list", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("/subscribe?plan=professional-monthly")).toBe(
      "/subscribe?plan=professional-monthly",
    );
    expect(safeNextPath("/join/token123")).toBe("/join/token123");
    expect(safeNextPath("/admin/organisations/1")).toBe("/admin/organisations/1");
  });

  it("refuses anything that could leave the app", () => {
    for (const next of [
      null,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "account",
      "/accounts-evil",
      "/join/",
      "/sign-in",
      "/%2F%2Fevil.example",
    ]) {
      expect(safeNextPath(next)).toBe("/");
    }
  });
});

describe("isKnownAppPath", () => {
  // Every page and route handler under src/app/app must be reachable, or the
  // proxy would answer it with a 404.
  it("covers every app route file", () => {
    const root = join(process.cwd(), "src", "app", "app");
    const routes = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((file) => /(^|\/)(page|route)\.tsx?$/.test(file))
      .map((file) => {
        const segments = dirname(file)
          .split(sep)
          .filter((segment) => segment !== "." && !/^\(.*\)$/.test(segment))
          .map((segment) => (segment.startsWith("[") ? "example" : segment));
        return `/${segments.join("/")}`;
      });
    expect(routes.length).toBeGreaterThan(5);
    for (const route of routes) expect(isKnownAppPath(route), route).toBe(true);
  });

  it("treats anything else as unknown (APP-01)", () => {
    for (const path of ["/pricing", "/features", "/accounts", "/sign-in-now", "/joined"]) {
      expect(isKnownAppPath(path), path).toBe(false);
    }
  });
});
