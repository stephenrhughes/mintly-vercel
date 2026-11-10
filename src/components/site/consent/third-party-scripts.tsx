"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { useConsent } from "@/components/site/consent/consent-store";
import { analyticsIds, trackPixelPageView } from "@/lib/analytics";
import { SIGNED_IN_HINT_COOKIE } from "@/lib/auth/hint-cookie";

// Loads the sales site's third parties (WEB-06), each only when allowed:
// - analytics consent: GA4 (with Google Consent Mode) and Microsoft Clarity
// - marketing consent: the Meta Pixel and Google Ads
// - always: Tawk.to chat, after the page is idle, hidden on the API
//   reference (ReDoc's controls sit in that corner) and for signed-in
//   visitors, as on the old site
// Cal.com loads only when someone clicks "Book a demo".

const CHAT_HIDDEN_PREFIXES = ["/docs", "/eiscd-docs"];

type TawkApi = { hideWidget?: () => void; showWidget?: () => void; onLoad?: () => void };
type WindowWithTawk = Window & { Tawk_API?: TawkApi };

export function ThirdPartyScripts() {
  const consent = useConsent();
  const pathname = usePathname();
  const signedIn = useSyncExternalStore(
    () => () => {},
    () => document.cookie.includes(`${SIGNED_IN_HINT_COOKIE}=1`),
    () => false,
  );

  const analytics = consent?.analytics === true;
  const marketing = consent?.marketing === true;
  const ids = analyticsIds;
  const gtagId = ids.ga || (marketing ? ids.googleAds : "");

  // A changed choice later in the visit updates Google's consent state; the
  // scripts themselves only load once per page load.
  useEffect(() => {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.("consent", "update", {
      analytics_storage: analytics ? "granted" : "denied",
      ad_storage: marketing ? "granted" : "denied",
      ad_user_data: marketing ? "granted" : "denied",
      ad_personalization: marketing ? "granted" : "denied",
    });
  }, [analytics, marketing]);

  // Meta Pixel page views on client-side navigation. The first page view is
  // sent by the pixel's own init script, so the first render is skipped.
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastPath.current !== null && lastPath.current !== pathname) trackPixelPageView();
    lastPath.current = pathname;
  }, [pathname]);

  const chatHidden =
    signedIn || CHAT_HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  useEffect(() => {
    const tawk = (window as WindowWithTawk).Tawk_API;
    if (!tawk) return;
    const apply = () => (chatHidden ? tawk.hideWidget?.() : tawk.showWidget?.());
    try {
      apply();
    } catch {
      tawk.onLoad = apply;
    }
  }, [chatHidden]);

  const [tawkProperty, tawkWidget] = ids.tawk.split("/");

  return (
    <>
      {(analytics || marketing) && gtagId && (
        <>
          <Script
            id="gtag-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{analytics_storage:'${analytics ? "granted" : "denied"}',ad_storage:'${marketing ? "granted" : "denied"}',ad_user_data:'${marketing ? "granted" : "denied"}',ad_personalization:'${marketing ? "granted" : "denied"}'});
gtag('js',new Date());
${analytics && ids.ga ? `gtag('config','${ids.ga}');` : ""}
${marketing && ids.googleAds ? `gtag('config','${ids.googleAds}');` : ""}`}
          </Script>
        </>
      )}
      {analytics && ids.clarity && (
        <Script id="clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${ids.clarity}");window.clarity("consent");`}
        </Script>
      )}
      {marketing && ids.metaPixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ids.metaPixel}');fbq('track','PageView');`}
        </Script>
      )}
      {tawkProperty && tawkWidget && !chatHidden && (
        <Script id="tawk" strategy="lazyOnload">
          {`var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src='https://embed.tawk.to/${tawkProperty}/${tawkWidget}';s1.charset='UTF-8';s1.setAttribute('crossorigin','*');s0.parentNode.insertBefore(s1,s0);})();`}
        </Script>
      )}
    </>
  );
}
