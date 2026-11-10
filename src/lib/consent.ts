// Cookie consent for the sales site (WEB-06). Nothing that sets cookies or
// tracks visitors loads until they agree: analytics (GA4, Microsoft
// Clarity) and marketing (Meta Pixel, Google Ads conversions) are separate
// choices. The old site's banner recorded a choice but blocked nothing;
// this one gates the scripts themselves.
//
// The choice is stored in a first-party cookie the server never reads, so
// sales pages stay static.

export const CONSENT_COOKIE = "mly_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // 180 days
/** Bump to ask everyone again, for example when a new category is added. */
export const CONSENT_VERSION = 2;

export type Consent = { analytics: boolean; marketing: boolean };

export const NO_CONSENT: Consent = { analytics: false, marketing: false };
export const ALL_CONSENT: Consent = { analytics: true, marketing: true };

/** "v2.a1.m0" */
export function serialiseConsent(consent: Consent): string {
  return `v${CONSENT_VERSION}.a${consent.analytics ? 1 : 0}.m${consent.marketing ? 1 : 0}`;
}

/** The stored choice, or null when the visitor hasn't chosen (or chose under an older version). */
export function parseConsent(value: string | null | undefined): Consent | null {
  const match = value?.match(/^v(\d+)\.a([01])\.m([01])$/);
  if (!match || Number(match[1]) !== CONSENT_VERSION) return null;
  return { analytics: match[2] === "1", marketing: match[3] === "1" };
}

/** Reads the choice from a document.cookie string. */
export function consentFromCookies(cookieHeader: string): Consent | null {
  const pair = cookieHeader.split(/;\s*/).find((cookie) => cookie.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(pair ? decodeURIComponent(pair.slice(CONSENT_COOKIE.length + 1)) : null);
}

export function consentCookie(consent: Consent, secure: boolean): string {
  return [
    `${CONSENT_COOKIE}=${serialiseConsent(consent)}`,
    "Path=/",
    `Max-Age=${CONSENT_MAX_AGE}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
