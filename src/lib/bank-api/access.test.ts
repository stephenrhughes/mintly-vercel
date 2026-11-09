import { describe, expect, it } from "vitest";

import type { SubscriptionView } from "@/lib/billing/status";

import { decideAccess, FAST_PACING_MS, productionApiUrl, SLOW_PACING_MS } from "./access";

const sub = (overrides: Partial<SubscriptionView> = {}): SubscriptionView => ({
  id: "s1",
  product: "bank_checker",
  stripePriceId: "price_x",
  status: "active",
  trialing: false,
  trialEnd: null,
  currentPeriodEnd: null,
  cancelAt: null,
  expired: false,
  maxTeamSize: 5,
  extraUsers: 0,
  apiKeyId: "key_1",
  keyEnabled: true,
  keyNoticeAt: null,
  keyNoticeDismissedAt: null,
  ...overrides,
});

const approved = { orgId: "org_1", reviewStatus: "approved" as const };

describe("decideAccess (TOOL-01, APPR-03)", () => {
  it("refuses users without an organisation", () => {
    expect(decideAccess({ membership: null, subscription: null, tier: null }).mode).toBe("denied");
  });

  it("sends pending organisations to the sandbox", () => {
    expect(
      decideAccess({
        membership: { orgId: "org_1", reviewStatus: "pending_review" },
        subscription: sub({ apiKeyId: null }),
        tier: null,
      }),
    ).toEqual({
      mode: "sandbox",
      orgId: "org_1",
      pacingMs: SLOW_PACING_MS,
      trialing: true,
      canDownload: false,
    });
  });

  it.each(["rejected", "suspended"] as const)("refuses %s organisations", (reviewStatus) => {
    expect(
      decideAccess({ membership: { orgId: "o", reviewStatus }, subscription: sub(), tier: null })
        .mode,
    ).toBe("denied");
  });

  it("refuses without a live subscription and enabled key", () => {
    for (const subscription of [
      null,
      sub({ expired: true }),
      sub({ keyEnabled: false }),
      sub({ apiKeyId: null }),
      sub({ product: "eiscd" }),
    ]) {
      expect(decideAccess({ membership: approved, subscription, tier: "professional" }).mode).toBe(
        "denied",
      );
    }
  });

  it("paces trials and Starter slowly, and other plans fast (TOOL-09)", () => {
    const pacing = (s: SubscriptionView, tier: string | null) => {
      const access = decideAccess({ membership: approved, subscription: s, tier });
      return access.mode === "production" ? access.pacingMs : null;
    };
    expect(pacing(sub({ trialing: true }), "professional")).toBe(SLOW_PACING_MS);
    expect(pacing(sub(), "starter")).toBe(SLOW_PACING_MS);
    expect(pacing(sub(), "standardPlus")).toBe(FAST_PACING_MS);
    expect(pacing(sub(), null)).toBe(FAST_PACING_MS);
  });

  it("allows the CSV download on paid plans only (TOOL-11)", () => {
    const access = (trialing: boolean) =>
      decideAccess({ membership: approved, subscription: sub({ trialing }), tier: null });
    expect(access(false)).toMatchObject({ mode: "production", keyId: "key_1", canDownload: true });
    expect(access(true)).toMatchObject({ canDownload: false });
  });
});

describe("productionApiUrl", () => {
  it("calls the production API by default", () => {
    expect(productionApiUrl({})).toBe("https://api.mintly.uk/bankAccount/v1");
  });

  it("takes BANK_API_URL outside production only", () => {
    const url = "https://sandbox.mintly.uk/bankAccount/v1/";
    expect(productionApiUrl({ BANK_API_URL: url, VERCEL_ENV: "preview" })).toBe(url.slice(0, -1));
    expect(productionApiUrl({ BANK_API_URL: url, VERCEL_ENV: "production" })).toBe(
      "https://api.mintly.uk/bankAccount/v1",
    );
  });
});
