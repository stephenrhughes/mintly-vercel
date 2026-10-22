import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Mintly/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bank account validation");
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
});

test("health check responds", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "ok" });
});

test("security and noindex headers are set", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  // Nothing outside production with SITE_INDEXABLE=true may be indexed.
  if (!process.env.EXPECT_INDEXABLE) {
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  }
});

test("unknown pages return 404", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
