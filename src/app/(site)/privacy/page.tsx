import type { Metadata } from "next";

import { ArticleLayout } from "@/components/site/article-layout";
import { JsonLd } from "@/components/site/json-ld";
import Content, { metadata as meta } from "@/content/legal/privacy.mdx";
import { pageJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/privacy");

export default function PrivacyPage() {
  return (
    <>
      <JsonLd data={pageJsonLd(pageInfo("/privacy", "Privacy Notice", "2022-10-05"))} />
      <ArticleLayout meta={meta} byline={false} cta={false}>
        <Content />
      </ArticleLayout>
    </>
  );
}
