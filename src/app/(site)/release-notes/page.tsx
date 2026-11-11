import type { Metadata } from "next";

import { ArticleLayout } from "@/components/site/article-layout";
import { JsonLd } from "@/components/site/json-ld";
import Content, { metadata as meta } from "@/content/release-notes.mdx";
import { latestEiscdRelease } from "@/lib/marketing/eiscd-release";
import { pageJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/release-notes");

const VOCALINK_SPECIFICATION_VERSION = "9.00";

// Worked out when the page is prerendered, and again whenever the cache
// is refreshed, so it stays current without a redeploy.
async function eiscdVersion() {
  "use cache";
  return latestEiscdRelease(new Date()).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function ReferenceData() {
  const version = await eiscdVersion();
  return (
    <div className="not-prose grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
      <h2 className="text-lg font-semibold sm:col-span-2">Reference Data</h2>
      <div>
        <p className="text-sm text-muted-foreground">Vocalink Specification Version:</p>
        <p className="font-semibold">
          {VOCALINK_SPECIFICATION_VERSION}{" "}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">latest</span>
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">EISCD Version:</p>
        <p className="font-semibold">
          {version}{" "}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">latest</span>
        </p>
      </div>
    </div>
  );
}

export default function ReleaseNotesPage() {
  return (
    <>
      <JsonLd data={pageJsonLd(pageInfo("/release-notes", "Release Notes", "2022-10-05"))} />
      <ArticleLayout meta={meta} byline={false} cta={false}>
        <Content components={{ ReferenceData }} />
      </ArticleLayout>
    </>
  );
}
