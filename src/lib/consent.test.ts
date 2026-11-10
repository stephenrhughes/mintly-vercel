import { describe, expect, it } from "vitest";

import {
  ALL_CONSENT,
  CONSENT_COOKIE,
  consentCookie,
  consentFromCookies,
  NO_CONSENT,
  parseConsent,
  serialiseConsent,
} from "./consent";

describe("consent cookie (WEB-06)", () => {
  it("round-trips each combination", () => {
    for (const analytics of [true, false]) {
      for (const marketing of [true, false]) {
        const consent = { analytics, marketing };
        expect(parseConsent(serialiseConsent(consent))).toEqual(consent);
      }
    }
  });

  it("treats a missing, malformed or old-version value as no choice yet", () => {
    for (const value of [null, undefined, "", "true", "false", "v1.a1.m1", "v2.a2.m0"]) {
      expect(parseConsent(value), String(value)).toBeNull();
    }
  });

  it("ignores the old site's mly_ cookie", () => {
    expect(consentFromCookies("mly_=true; mly_ckk=3")).toBeNull();
  });

  it("reads the choice from document.cookie", () => {
    expect(consentFromCookies(`a=1; ${CONSENT_COOKIE}=v2.a1.m0; b=2`)).toEqual({
      analytics: true,
      marketing: false,
    });
  });

  it("writes a first-party, lax cookie that is secure over HTTPS", () => {
    expect(consentCookie(ALL_CONSENT, true)).toBe(
      `${CONSENT_COOKIE}=v2.a1.m1; Path=/; Max-Age=15552000; SameSite=Lax; Secure`,
    );
    expect(consentCookie(NO_CONSENT, false)).not.toContain("Secure");
  });
});
