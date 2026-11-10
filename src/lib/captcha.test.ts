import { describe, expect, it, vi } from "vitest";

import { RECAPTCHA_VERIFY_URL, verifyCaptcha } from "./captcha";

const input = { action: "sso", hostnames: ["app.mintly.uk:443"] };
const env = { RECAPTCHA_SECRET_KEY: "secret" };

function fakeFetch(body: unknown, ok = true) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));
}

describe("verifyCaptcha (SSO-02)", () => {
  it("is skipped without a secret, except on production", async () => {
    expect(await verifyCaptcha(null, input, { env: {} })).toEqual({ ok: true, skipped: true });
    expect(await verifyCaptcha("t", input, { env: { VERCEL_ENV: "production" } })).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("needs a token once configured", async () => {
    expect(await verifyCaptcha("", input, { env })).toEqual({ ok: false, reason: "missing" });
  });

  it("passes a good score for the right action and host", async () => {
    const fetch = fakeFetch({
      success: true,
      score: 0.9,
      action: "sso",
      hostname: "app.mintly.uk",
    });
    expect(await verifyCaptcha("t", { ...input, remoteIp: "1.2.3.4" }, { env, fetch })).toEqual({
      ok: true,
      skipped: false,
    });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RECAPTCHA_VERIFY_URL);
    const sent = init.body as URLSearchParams;
    expect(sent.get("secret")).toBe("secret");
    expect(sent.get("response")).toBe("t");
    expect(sent.get("remoteip")).toBe("1.2.3.4");
  });

  it.each([
    ["a low score", { success: true, score: 0.2, action: "sso", hostname: "app.mintly.uk" }],
    ["another action", { success: true, score: 0.9, action: "login", hostname: "app.mintly.uk" }],
    ["another host", { success: true, score: 0.9, action: "sso", hostname: "evil.example" }],
    ["a failure", { success: false, "error-codes": ["invalid-input-response"] }],
  ])("rejects %s", async (_name, body) => {
    expect(await verifyCaptcha("t", input, { env, fetch: fakeFetch(body) })).toEqual({
      ok: false,
      reason: "rejected",
    });
  });

  it("reports Google being unavailable", async () => {
    expect(await verifyCaptcha("t", input, { env, fetch: fakeFetch({}, false) })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
