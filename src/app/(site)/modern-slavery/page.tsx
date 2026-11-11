import type { Metadata } from "next";

import { ArticleLayout } from "@/components/site/article-layout";
import { JsonLd } from "@/components/site/json-ld";
import Content, { metadata as meta } from "@/content/legal/modern-slavery.mdx";
import { pageJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/modern-slavery");

export default function ModernSlaveryPage() {
  return (
    <>
      <JsonLd
        data={pageJsonLd(pageInfo("/modern-slavery", "Modern Slavery Notice", "2022-10-05"))}
      />
      <ArticleLayout meta={meta} byline={false} cta={false}>
        <Content />
      </ArticleLayout>
    </>
  );
}
