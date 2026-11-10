import { describe, expect, it } from "vitest";

import { appCsp, salesCsp, securityHeaderRules } from "./csp";

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((part) => part.startsWith(`${name} `) || part === name)
    ?.split(" ")
    .slice(1) ?? null;

describe("sales CSP (WEB-04)", () => {
  const csp = salesCsp({ NODE_ENV: "production" });

  it("allows the third parties the sales site loads", () => {
    const scripts = directive(csp, "script-src")!;
    for (const host of [
      "https://www.googletagmanager.com",
      "https://connect.facebook.net",
      "https://*.clarity.ms",
      "https://embed.tawk.to",
      "https://app.cal.com",
      "https://www.google.com/recaptcha/",
    ]) {
      expect(scripts, host).toContain(host);
    }
    expect(directive(csp, "frame-src")).toContain("https://www.youtube-nocookie.com");
    expect(directive(csp, "worker-src")).toContain("blob:");
  });

  it("never allows eval in production, and does in development", () => {
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(salesCsp({ NODE_ENV: "development" }), "script-src")).toContain(
      "'unsafe-eval'",
    );
  });

  it("blocks plugins and base-tag injection", () => {
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "base-uri")).toEqual(["'none'"]);
  });
});

describe("app CSP (APP-10)", () => {
  const csp = appCsp({
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  });

  it("is tighter than the sales CSP: no analytics, chat or pixels", () => {
    expect(csp).not.toContain("googletagmanager");
    expect(csp).not.toContain("facebook");
    expect(csp).not.toContain("tawk");
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
  });

  it("lets the browser reach Supabase and reCAPTCHA", () => {
    expect(directive(csp, "connect-src")).toEqual(
      expect.arrayContaining([
        "https://abc.supabase.co",
        "wss://abc.supabase.co",
        "https://www.google.com/recaptcha/",
      ]),
    );
  });
});

describe("security header rules", () => {
  const csp = (rule: { headers: { key: string; value: string }[] }) =>
    rule.headers.find((h) => h.key === "Content-Security-Policy")?.value;

  it("in path mode, gives /app the app CSP and everything else the sales CSP", () => {
    const rules = securityHeaderRules({ NODE_ENV: "production" });
    const sales = rules.find((r) => r.source.startsWith("/((?!app"))!;
    expect(csp(sales)).toContain("googletagmanager");
    for (const source of ["/app", "/app/:path*"]) {
      expect(csp(rules.find((r) => r.source === source)!)).not.toContain("googletagmanager");
    }
  });

  it("with an app host, splits by host", () => {
    const rules = securityHeaderRules({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://app.mintly.uk",
    });
    expect(rules).toHaveLength(2);
    expect(rules[0].missing?.[0].value).toBe("app\\.mintly\\.uk");
    expect(rules[1].has?.[0].value).toBe("app\\.mintly\\.uk");
    expect(csp(rules[1])).not.toContain("googletagmanager");
  });

  it("sends the baseline headers and any extras on every rule", () => {
    for (const rule of securityHeaderRules({}, [
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ])) {
      const keys = rule.headers.map((h) => h.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          "Strict-Transport-Security",
          "X-Content-Type-Options",
          "X-Frame-Options",
          "Referrer-Policy",
          "Permissions-Policy",
          "X-Robots-Tag",
        ]),
      );
    }
  });
});
