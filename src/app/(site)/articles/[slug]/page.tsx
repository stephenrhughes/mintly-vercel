import type { Metadata } from "next";
import type { MDXContent } from "mdx/types";
import { notFound } from "next/navigation";

import { ArticleLayout } from "@/components/site/article-layout";
import { JsonLd } from "@/components/site/json-ld";
import type { ContentMeta } from "@/content/articles";
import { articleJsonLd } from "@/lib/marketing/json-ld";
import { pageMetadata } from "@/lib/marketing/metadata";
import { siteRoute, slugsUnder } from "@/lib/marketing/routes";

// The 11 articles, from src/content/articles/<slug>.mdx (plan §6.10).
export function generateStaticParams() {
  return slugsUnder("/articles/").map((slug) => ({ slug }));
}

const SLUGS = new Set(slugsUnder("/articles/"));

async function load(slug: string) {
  if (!SLUGS.has(slug)) notFound();
  const mod = (await import(`@/content/articles/${slug}.mdx`)) as {
    default: MDXContent;
    metadata: ContentMeta;
  };
  return { Content: mod.default, meta: mod.metadata };
}

export async function generateMetadata({
  params,
}: PageProps<"/articles/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUGS.has(slug)) return {};
  return pageMetadata({ ...siteRoute(`/articles/${slug}`), type: "article" });
}

export default async function ArticlePage({ params }: PageProps<"/articles/[slug]">) {
  const { slug } = await params;
  const { Content, meta } = await load(slug);
  const path = `/articles/${slug}`;
  const route = siteRoute(path);
  return (
    <>
      <JsonLd
        data={articleJsonLd(
          {
            path,
            title: route.title.replace(/ \| Mintly$/, ""),
            published: `${meta.published}T03:00:00.000Z`,
            modified: `${meta.modified}T12:00:00.000Z`,
          },
          meta.faq,
        )}
      />
      <ArticleLayout
        meta={meta}
        crumbs={[{ label: "Articles", href: "/articles" }, { label: route.label }]}
      >
        <Content />
      </ArticleLayout>
    </>
  );
}
