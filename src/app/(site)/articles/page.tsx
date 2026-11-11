import type { Metadata } from "next";

import { ArticleList } from "@/components/site/article-list";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section } from "@/components/site/section";
import { ARTICLE_CARDS, ARTICLE_TAGS } from "@/content/articles";
import { pageJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/articles");

export default function ArticlesPage() {
  return (
    <>
      <JsonLd data={pageJsonLd(pageInfo("/articles", "Articles", "2025-07-30"))} />
      <PageHero
        compact
        title="Check bank details fast to keep you focused on your business"
        lead="Our useful articles and guides to help you find out about bank account and sort code validation."
      />
      <Section>
        <ArticleList articles={ARTICLE_CARDS} tags={[...ARTICLE_TAGS]} />
      </Section>
    </>
  );
}
