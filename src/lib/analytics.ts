// Analytics events for the sales site (WEB-06). Every call is a no-op until
// the visitor has agreed to analytics cookies, and event parameters are
// typed so no personal data (email addresses, bank details) can be sent:
// the old enquiry form sent the enquirer's email to GA as a user ID.

import { currentConsent } from "@/components/site/consent/consent-store";

// Referenced literally so Next.js inlines them into the client bundle.
export const analyticsIds = {
  ga: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "",
  googleAds: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "",
  /** "AW-…/label" for the free checker conversion. */
  googleAdsConversion: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION ?? "",
  metaPixel: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",
  clarity: process.env.NEXT_PUBLIC_CLARITY_ID ?? "",
  /** "propertyId/widgetId" */
  tawk: process.env.NEXT_PUBLIC_TAWK_CHAT ?? "",
};

/** The events the old site sent, by name (GA4 recommends snake_case). */
export type AnalyticsEvent =
  | "try_it"
  | "unlock_teaser_clicked"
  | "cta_click"
  | "select_plan"
  | "calculator_cta"
  | "faq_search"
  | "faq_opened"
  | "faq_topic"
  | "download_agent_skill"
  | "enquiry_step"
  | "enquiry_sent"
  | "enquiry_cop_exit"
  | "open_download_modal"
  | "confirm_download"
  | "book_demo"
  | "support_channel"
  | "calculator_input";

/** Short, non-personal values only: labels, IDs of questions, outcomes, counts. */
export type EventParams = Record<string, string | number | boolean | undefined>;

type Gtag = (...args: unknown[]) => void;
type WindowWithTrackers = Window & { gtag?: Gtag; fbq?: (...args: unknown[]) => void };

const MAX_PARAM_LENGTH = 100;
const looksPersonal = (value: string) => value.includes("@") || /\d{6,}/.test(value);

/** Drops anything that looks like an email address or a long number. */
export function safeParams(params: EventParams = {}): EventParams {
  const clean: EventParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      if (looksPersonal(value)) continue;
      clean[key] = value.slice(0, MAX_PARAM_LENGTH);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function track(event: AnalyticsEvent, params?: EventParams) {
  if (typeof window === "undefined" || !currentConsent()?.analytics) return;
  (window as WindowWithTrackers).gtag?.("event", event, safeParams(params));
}

/** The free checker's Google Ads conversion (marketing consent only). */
export function trackConversion() {
  const target = analyticsIds.googleAdsConversion;
  if (typeof window === "undefined" || !target || !currentConsent()?.marketing) return;
  (window as WindowWithTrackers).gtag?.("event", "conversion", { send_to: target });
}

export function trackPixelPageView() {
  if (typeof window === "undefined" || !currentConsent()?.marketing) return;
  (window as WindowWithTrackers).fbq?.("track", "PageView");
}
