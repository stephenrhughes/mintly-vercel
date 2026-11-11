import type { Metadata } from "next";
import Link from "next/link";

import { EmailCapture } from "@/components/site/email-capture/email-capture";
import { JsonLd } from "@/components/site/json-ld";
import { Section } from "@/components/site/section";
import { VideoEmbed } from "@/components/site/video-embed";
import { Button } from "@/components/ui/button";
import { pageJsonLd } from "@/lib/marketing/json-ld";
import { pageMetadata } from "@/lib/marketing/metadata";
import { pageInfo, siteRoute } from "@/lib/marketing/routes";

// The link-in-bio page. Not indexed and not in the sitemap, as before.
export const metadata: Metadata = pageMetadata({ ...siteRoute("/links") });

export default function LinksPage() {
  return (
    <>
      <JsonLd data={pageJsonLd(pageInfo("/links", "Mintly Quick Links", "2025-05-20"))} />
      <Section narrow>
        <h1 className="text-center text-4xl font-semibold tracking-tight">Quick Links</h1>
        <div className="mt-10 flex flex-col items-center gap-10 text-center">
          <div>
            <p>Quickly check sort codes and account numbers with our free tool</p>
            <Button asChild className="mt-3">
              <Link href="/sort-code-checker">Free Sort Code Checker</Link>
            </Button>
          </div>
          <EmailCapture />
          <div className="w-full">
            <p className="mb-3">See our tools in action</p>
            <VideoEmbed id="ksC-T3O11RY" title="Mintly Toolset Demo" />
          </div>
        </div>
      </Section>
    </>
  );
}
