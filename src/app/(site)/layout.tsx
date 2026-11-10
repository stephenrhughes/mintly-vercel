import { ConsentBanner } from "@/components/site/consent/consent-banner";
import { ThirdPartyScripts } from "@/components/site/consent/third-party-scripts";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

// Every sales page is prerendered in full: nothing here reads cookies,
// headers or the session (APP-03). The build fails if a page stops being
// static (ensureStatic), which keeps the CDN and Lighthouse happy.
export const ensureStatic = "navigation";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <ConsentBanner />
      <ThirdPartyScripts />
    </>
  );
}
