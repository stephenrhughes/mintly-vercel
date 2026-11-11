import type { Metadata } from "next";
import type { MDXContent } from "mdx/types";
import { notFound } from "next/navigation";

import { ArticleLayout } from "@/components/site/article-layout";
import { JsonLd } from "@/components/site/json-ld";
import type { ContentMeta } from "@/content/articles";
import { integrationGuideJsonLd } from "@/lib/marketing/json-ld";
import { pageMetadata } from "@/lib/marketing/metadata";
import { siteRoute, slugsUnder } from "@/lib/marketing/routes";

// The 7 integration guides, from src/content/integration-guides/<slug>.mdx.
export function generateStaticParams() {
  return slugsUnder("/integration-guides/").map((slug) => ({ slug }));
}

const SLUGS = new Set(slugsUnder("/integration-guides/"));

async function load(slug: string) {
  if (!SLUGS.has(slug)) notFound();
  const mod = (await import(`@/content/integration-guides/${slug}.mdx`)) as {
    default: MDXContent;
    metadata: ContentMeta;
  };
  return { Content: mod.default, meta: mod.metadata };
}

export async function generateMetadata({
  params,
}: PageProps<"/integration-guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUGS.has(slug)) return {};
  return pageMetadata({ ...siteRoute(`/integration-guides/${slug}`), type: "article" });
}

export default async function IntegrationGuidePage({
  params,
}: PageProps<"/integration-guides/[slug]">) {
  const { slug } = await params;
  const { Content, meta } = await load(slug);
  const path = `/integration-guides/${slug}`;
  const route = siteRoute(path);
  return (
    <>
      <JsonLd
        data={integrationGuideJsonLd({
          path,
          title: route.title.replace(/ \| Mintly$/, ""),
          published: `${meta.published}T03:00:00.000Z`,
          modified: `${meta.modified}T12:00:00.000Z`,
        })}
      />
      <ArticleLayout
        meta={meta}
        crumbs={[
          { label: "Integration Guides", href: "/integration-guides" },
          { label: route.label },
        ]}
      >
        <Content />
      </ArticleLayout>
    </>
  );
}
