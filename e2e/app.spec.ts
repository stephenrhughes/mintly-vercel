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
