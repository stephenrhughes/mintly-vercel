import type { Metadata } from "next";

import { ArticleLayout } from "@/components/site/article-layout";
import { JsonLd } from "@/components/site/json-ld";
import Content, { metadata as meta } from "@/content/legal/eiscd-terms.mdx";
import { pageJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/eiscd-terms");

export default function EiscdTermsPage() {
  return (
    <>
      <JsonLd
        data={pageJsonLd(pageInfo("/eiscd-terms", "EISCD Terms & Conditions", "2025-11-26"))}
      />
      <ArticleLayout meta={meta} byline={false} cta={false}>
        <Content />
      </ArticleLayout>
    </>
  );
}
