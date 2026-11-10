import { expect, test } from "@playwright/test";

import { siteRedirects } from "../src/lib/marketing/redirects";
import { siteRoutes } from "../src/lib/marketing/routes";

// The sales site (plan §6.9, §6.10). Runs against `npm run start` without
// Supabase, Resend or a free checker key, so the checker answers from the
// built-in fake and emails are logged.

test.describe("every page and redirect (WEB-01, WEB-03)", () => {
  for (const route of siteRoutes) {
    test(`${route.path} renders with its title and canonical`, async ({ request }) => {
      const response = await request.get(route.path);
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain(`<title>${route.title.replace(/&/g, "&amp;")}</title>`);
      // Next.js writes the home page's canonical without the trailing slash.
      const canonical = `https://www.mintly.uk${route.path === "/" ? "" : route.path}`;
      expect(html).toContain(`<link rel="canonical" href="${canonical}"/>`);
      expect(html).toContain('type="application/ld+json"');
    });
  }

  test("old URLs redirect permanently to their pages", async ({ request }) => {
    for (const { source, destination } of siteRedirects) {
      const first = await request.get(source, { maxRedirects: 0 });
      expect(first.status(), source).toBe(308);
      // Next.js strips a trailing slash first, so a few take two hops.
      const final = await request.get(source);
      expect(final.status(), source).toBe(200);
      expect(new URL(final.url()).pathname, source).toBe(destination);
    }
  });

  test("the sitemap lists the public pages and not /links", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const route of siteRoutes) {
      const listed = xml.includes(`${route.path === "/" ? "/" : route.path}</loc>`);
      expect(listed, route.path).toBe(!route.hidden);
    }
  });

  test("the spec downloads and skill zips are still served", async ({ request }) => {
    for (const path of [
      "/assets/swagger.yaml",
      "/assets/swagger.json",
      "/assets/eiscd-openapi.yaml",
      "/assets/mintly-api-skill.zip",
      "/assets/docs/Mintly-API.postman_collection.json",
      "/vendor/redoc.standalone.js",
      "/llms.txt",
    ]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });
});

test.describe("headers (WEB-04, APP-10)", () => {
  test("sales pages send the sales CSP, and the app its own", async ({ request }) => {
    const sales = (await request.get("/pricing")).headers()["content-security-policy"];
    expect(sales).toContain("https://www.googletagmanager.com");
    expect(sales).toContain("object-src 'none'");
    const app = (await request.get("/app/sign-in")).headers()["content-security-policy"];
    expect(app).not.toContain("googletagmanager");
    expect(app).toContain("frame-ancestors 'none'");
  });
});

test.describe("cookie consent (WEB-06)", () => {
  test("nothing third-party loads before a choice, and the choice is remembered", async ({
    page,
    context,
  }) => {
    const thirdParty: string[] = [];
    page.on("request", (request) => {
      const host = new URL(request.url()).host;
      if (/googletagmanager|google-analytics|facebook|clarity|doubleclick/.test(host))
        thirdParty.push(host);
    });
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: "Cookies on Mintly" });
    await expect(banner).toBeVisible();
    await page.waitForTimeout(500);
    expect(thirdParty).toEqual([]);

    await banner.getByRole("button", { name: "Reject all" }).click();
    await expect(banner).toBeHidden();
    const cookie = (await context.cookies()).find((c) => c.name === "mly_consent");
    expect(cookie?.value).toBe("v2.a0.m0");

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Cookies on Mintly" })).toBeHidden();
    expect(thirdParty).toEqual([]);

    await page.getByRole("button", { name: "Cookie settings" }).click();
    await expect(page.getByRole("dialog", { name: "Cookies on Mintly" })).toBeVisible();
  });
});

test.describe("free checker (FREE-01 to FREE-03)", () => {
  test("checks a sort code and account and shows the bank name only", async ({ page }) => {
    await page.goto("/sort-code-checker");
    await page.getByRole("button", { name: "Reject all" }).click();
    const form = page.getByRole("form", { name: "Free sort code checker" });
    await form.getByLabel("Sort code").fill("42-42-42");
    await form.getByLabel(/Account number/).fill("42424242");
    await form.getByRole("button", { name: "Validate" }).click();
    await expect(page.getByText("Valid sort code and account")).toBeVisible();
    await expect(page.getByText("Bank Name: MINTLY TEST BANK")).toBeVisible();
    // The count comes from the server's per-IP limit, so it depends on earlier runs.
    await expect(page.getByText(/Free checks remaining this week/)).toContainText(/\d/);
  });

  test("the API refuses cross-site requests and bad input", async ({ request, baseURL }) => {
    const crossSite = await request.post("/api/free-check", {
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      data: { sortCode: "424242" },
    });
    expect(crossSite.status()).toBe(403);
    const bad = await request.post("/api/free-check", {
      headers: { "content-type": "application/json", origin: baseURL! },
      data: { sortCode: "12-34" },
    });
    expect(bad.status()).toBe(400);
  });
});

test.describe("enquiry (LEAD-01)", () => {
  test("qualifies an API enquiry and recommends a plan", async ({ page }) => {
    await page.goto("/pricing");
    await page.getByRole("button", { name: "Reject all" }).click();
    const enquiry = page.locator("#contact");
    // The product is pre-selected on /pricing, but still asked.
    await expect(
      enquiry.getByRole("button", { name: /Check that bank details are valid/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await enquiry.getByRole("button", { name: /Check that bank details are valid/ }).click();
    await enquiry.getByRole("button", { name: /real and correctly formed/ }).click();
    await enquiry.getByRole("button", { name: "250 to 10,000" }).click();
    await enquiry.getByRole("button", { name: /One at a time/ }).click();
    await enquiry.getByRole("button", { name: /integrate the REST API/ }).click();
    await enquiry.getByRole("button", { name: "None that we know of" }).click();
    await enquiry.getByRole("button", { name: "Continue" }).click();
    await enquiry.getByRole("button", { name: "Skip this one" }).click();
    await enquiry.getByPlaceholder("Your name").fill("Pat Example");
    await enquiry.getByPlaceholder("Work email address").fill("pat@example.co.uk");
    await enquiry.getByPlaceholder("Company").fill("Example Ltd");
    await enquiry.getByRole("button", { name: /See what we/ }).click();
    await expect(enquiry.getByText(/your enquiry is with us/)).toBeVisible();
    await expect(enquiry.getByText(/Standard Plus Plan is the one that fits/)).toBeVisible();
  });

  test("explains Confirmation of Payee and lets people leave", async ({ page }) => {
    await page.goto("/faq");
    await page.getByRole("button", { name: "Reject all" }).click();
    const enquiry = page.locator("#contact");
    await enquiry.getByRole("button", { name: /Check that bank details are valid/ }).click();
    await enquiry.getByRole("button", { name: /account holder's name matches/ }).click();
    await expect(enquiry.getByText(/Name matching is a separate service/)).toBeVisible();
    await enquiry.getByRole("button", { name: /not what I need/ }).click();
    await expect(enquiry.getByText(/not the right fit/)).toBeVisible();
  });
});

test.describe("pages that do something", () => {
  test("the price calculator recommends a plan and links to the trial (WEB-05)", async ({
    page,
  }) => {
    await page.goto("/pricing-calculator");
    await page.getByLabel("Bank account checks per month", { exact: true }).first().fill("5000");
    await expect(page.getByRole("heading", { name: "Standard Plus Plan" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start a free trial" })).toHaveAttribute(
      "href",
      "/app/subscribe?plan=standardPlus",
    );
  });

  test("the pricing page sends the chosen plan to the app (BUY-01)", async ({ page }) => {
    await page.goto("/pricing");
    await page.getByRole("button", { name: "Annual" }).click();
    await expect(page.getByRole("link", { name: "Try for free" }).first()).toHaveAttribute(
      "href",
      "/app/subscribe?plan=professional&interval=annual",
    );
  });

  test("the FAQ search narrows the answers", async ({ page }) => {
    await page.goto("/faq");
    await page.getByRole("searchbox", { name: "Search the FAQ" }).fill("confirmation of payee");
    await expect(page.getByText(/answers match/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Confirmation of Payee/ })).toBeVisible();
  });
});
