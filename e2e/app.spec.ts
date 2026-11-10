import { expect, test } from "@playwright/test";

// The app in path mode (APP-12): served under /app on the same host. These
// run without a Supabase project, so they cover routing, layouts and form
// validation, not signing in.

test("signed-out visitors are sent to sign-in, keeping where they were going", async ({ page }) => {
  await page.goto("/app/account");
  await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Faccount$/);
  await expect(page.getByRole("heading", { name: "Sign in to Mintly" })).toBeVisible();
});

test("sign-in uses the auth layout, with no sales menu (LAY-01, LAY-06)", async ({ page }) => {
  await page.goto("/app/sign-in");
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to mintly.uk" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Products" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
    "href",
    "/app/forgot-password",
  );
});

test("sign-up checks the form before anything is sent (AUTH-02, AUTH-05)", async ({ page }) => {
  await page.goto("/app/sign-up?next=%2Fsubscribe%3Fplan%3Dstarter");
  await page.getByLabel("First name").fill("Jane");
  await page.getByLabel("Work email").fill("jane@acme.example");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Enter your last name")).toBeVisible();
  await expect(page.getByText(/At least 8 characters.*Needs a symbol/)).toBeVisible();
  await expect(
    page.getByText("Please accept the terms and conditions and privacy policy"),
  ).toBeVisible();
  // The entered values survive the round trip, and the plan intent with them.
  await expect(page.getByLabel("First name")).toHaveValue("Jane");
  await expect(page.locator('input[name="next"]')).toHaveValue("/subscribe?plan=starter");
});

test("an unsafe next value is dropped (APP-05)", async ({ page }) => {
  await page.goto("/app/sign-in?next=https%3A%2F%2Fevil.example");
  await expect(page.locator('input[name="next"]')).toHaveValue("/");
});

test("old portal URLs redirect into the app (APP-09)", async ({ request }) => {
  for (const [from, to] of [
    ["/dashboard", "/app"],
    ["/monitor", "/app/usage"],
    ["/success", "/app/welcome"],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(308);
    expect(new URL(response.headers().location, "http://x").pathname, from).toBe(to);
  }
});

test("sales pages aren't served by the app (APP-01)", async ({ page }) => {
  const response = await page.goto("/app/pricing");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Go to Overview" })).toBeVisible();
});

test("the app is never indexed (APP-10)", async ({ request }) => {
  const page = await request.get("/app/sign-in");
  expect(page.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  const robots = await request.get("/app/robots.txt");
  expect(await robots.text()).toContain("Disallow: /");
});

test("the sales site links to the app and sets no cookies (APP-03, APP-05, LAY-02)", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.headers()["set-cookie"]).toBeUndefined();
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/app/sign-in",
  );
  await expect(header.getByRole("link", { name: "Start free trial" })).toHaveAttribute(
    "href",
    "/app/sign-up",
  );
  await expect(header.getByRole("link", { name: "Tools" })).toHaveCount(0);
});

test("the sales site shows Open app when the signed-in hint is set (APP-06)", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "mintly_signed_in", value: "1", url: baseURL! }]);
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Open app" })).toHaveAttribute(
    "href",
    "/app",
  );
});

test("billing pages need a signed-in user, and keep the plan chosen (BUY-02, SUB-05)", async ({
  page,
}) => {
  await page.goto("/app/subscribe?plan=professional&interval=annual");
  await expect(page).toHaveURL(
    /\/app\/sign-in\?next=%2Fsubscribe%3Fplan%3Dprofessional%26interval%3Dannual$/,
  );

  await page.goto("/app/subscription");
  await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fsubscription$/);

  await page.goto("/app/welcome?session_id=cs_test_123");
  await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fwelcome/);
});

test("sign-up names the plan picked on the pricing page (BUY-02)", async ({ page }) => {
  await page.goto("/app/sign-up?next=%2Fsubscribe%3Fplan%3DstandardPlus");
  await expect(
    page.getByText("You're starting a free trial of the Standard Plus Plan."),
  ).toBeVisible();

  // A made-up plan is ignored.
  // (The streamed card briefly sits next to its fallback, which has the same text.)
  await page.goto("/app/sign-up?next=%2Fsubscribe%3Fplan%3Dconstructor");
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(
    page.getByText("Start a 14-day free trial. No card needed.").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/You're starting a free trial/)).toHaveCount(0);
});

test("the Stripe webhook refuses unsigned requests (PROV-10)", async ({ request }) => {
  const response = await request.post("/api/webhooks/stripe", { data: "{}" });
  // 503 without Stripe configured (as in CI), 400 for a missing signature otherwise.
  expect([400, 503]).toContain(response.status());
});

test("the reminders job refuses calls without the cron secret (plan §8)", async ({ request }) => {
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
  const wrong = await request.get("/api/cron/reminders", {
    headers: { authorization: "Bearer guess" },
  });
  expect(wrong.status()).toBe(401);
});

test("the review queue needs a signed-in admin (plan §6.8)", async ({ page }) => {
  await page.goto("/app/admin/reviews/domains");
  await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fadmin%2Freviews%2Fdomains$/);
});

// The admin pages phase 5 adds (plan §6.8): each one sends a signed-out
// visitor to sign in, keeping where they were going.
const adminPages = [
  "/admin",
  "/admin/organisations",
  "/admin/organisations/00000000-0000-0000-0000-000000000000",
  "/admin/plans",
];

test("the admin pages need a signed-in admin (plan §6.8)", async ({ page }) => {
  for (const path of adminPages) {
    await page.goto(`/app${path}`);
    const url = new URL(page.url());
    expect(url.pathname, path).toBe("/app/sign-in");
    expect(url.searchParams.get("next"), path).toBe(path);
  }
});

test("changing plan needs a signed-in user (PLAN-01)", async ({ page }) => {
  await page.goto("/app/subscription/change?tier=professional&interval=annual");
  await expect(page).toHaveURL(
    /\/app\/sign-in\?next=%2Fsubscription%2Fchange%3Ftier%3Dprofessional%26interval%3Dannual$/,
  );
  await page.goto("/app/subscription/change/card-added?session_id=cs_test_1");
  await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fsubscription%2Fchange%2Fcard-added/);
});

test("tools and usage need a signed-in user (plan §6.2, §6.4)", async ({ page }) => {
  await page.goto("/app/tools");
  await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Ftools$/);
  await page.goto("/app/usage");
  await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fusage$/);
});

test("the check proxy refuses cross-site and signed-out requests (plan §6.2)", async ({
  request,
  baseURL,
}) => {
  const body = { kind: "account", sortCode: "424242", accountNumber: "42424242" };
  // No Origin, or another site's: refused before anything else.
  expect((await request.post("/api/check", { data: body })).status()).toBe(403);
  const crossSite = await request.post("/api/check/batch", {
    data: { dataType: "sortcode", lines: ["424242"] },
    headers: { origin: "https://evil.example" },
  });
  expect(crossSite.status()).toBe(403);
  // Same origin but not signed in.
  const signedOut = await request.post("/api/check", {
    data: body,
    headers: { origin: new URL(baseURL!).origin },
  });
  expect(signedOut.status()).toBe(401);
});

test("the usage sync refuses calls without the cron secret (plan §8)", async ({ request }) => {
  expect((await request.get("/api/cron/usage-sync")).status()).toBe(401);
});

test("the team page needs a signed-in user (plan §6.6)", async ({ page }) => {
  await page.goto("/app/team");
  await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fteam$/);
});

test("an invite link opens in the auth layout and explains a bad link (JOIN-06, LAY-01)", async ({
  page,
}) => {
  const response = await page.goto("/app/join/not-a-real-invite-token-0000");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Invite not found" })).toBeVisible();
  await expect(page.getByText(/This invite link isn't valid/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to mintly.uk" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Products" })).toHaveCount(0);
});

test("old invite links redirect to the new join page (plan §8)", async ({ page }) => {
  await page.goto("/join?invite=3f2b9c1e-8a4d-4c4e-9b8a-1d2e3f4a5b6c");
  await expect(page).toHaveURL(/\/app\/join\/3f2b9c1e-8a4d-4c4e-9b8a-1d2e3f4a5b6c$/);
  await expect(page.getByRole("heading", { name: "Invite not found" })).toBeVisible();
});

test("sign-in and sign-up keep an invite's email and return to it (JOIN-01)", async ({ page }) => {
  const query = "?next=%2Fjoin%2Fabcdefghijklmnop&email=mia%40acme.example";
  await page.goto(`/app/sign-in${query}`);
  await expect(page.getByLabel("Work email")).toHaveValue("mia@acme.example");
  await expect(page.locator('input[name="next"]')).toHaveValue("/join/abcdefghijklmnop");

  await page.goto(`/app/sign-up${query}`);
  await expect(page.getByLabel("Work email")).toHaveValue("mia@acme.example");
  await expect(page.getByText(/Create an account to join your team/)).toBeVisible();
});

test("sign-in offers SSO, and falls back to the password form (SSO-01, SSO-03)", async ({
  page,
}) => {
  await page.goto("/app/sign-in");
  await page.getByRole("button", { name: "Sign in with SSO" }).click();
  const sso = page.getByRole("form", { name: "Sign in with SSO" });
  await sso.getByLabel("Work email for SSO").fill("sam@acme.example");
  await sso.getByRole("button", { name: "Continue with SSO" }).click();
  // Without a Supabase project (as in CI) the look-up is unavailable.
  await expect(sso.getByText(/Sign-in isn't available on this deployment yet/)).toBeVisible();

  await page.goto("/app/sign-in?sso=none&email=sam%40acme.example");
  await expect(page.getByText(/doesn't sign in to Mintly with SSO/)).toBeVisible();
  await expect(page.getByLabel("Work email", { exact: true })).toHaveValue("sam@acme.example");
});
