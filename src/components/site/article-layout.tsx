import Link from "next/link";
import type { ReactNode } from "react";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { type Crumb } from "@/components/site/breadcrumb";
import { FaqList } from "@/components/site/faq-list";
import { PageHero } from "@/components/site/page-hero";
import { Button } from "@/components/ui/button";
import type { ContentMeta } from "@/content/articles";
import { longDate } from "@/lib/billing/format";

/** An article, guide, release notes or legal page from MDX. */
export function ArticleLayout({
  meta,
  crumbs,
  children,
  byline = true,
  cta = true,
}: {
  meta: ContentMeta;
  crumbs?: Crumb[];
  children: ReactNode;
  byline?: boolean;
  cta?: boolean;
}) {
  return (
    <>
      <PageHero compact crumbs={crumbs} title={meta.heading}>
        {byline && (
          <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70">
            {meta.readTime && <span>Read time: {meta.readTime}</span>}
            {meta.modified && (
              <span>Last updated: {longDate(new Date(`${meta.modified}T12:00:00Z`))}</span>
            )}
            <span>Author: Stephen Hughes, Founder of Mintly</span>
          </p>
        )}
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <article className="prose max-w-none prose-slate prose-headings:tracking-tight prose-a:text-primary prose-pre:bg-transparent prose-pre:p-0 prose-table:text-sm prose-img:rounded-xl">
          {children}
        </article>
        {meta.faq && meta.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight">Frequently Asked Questions</h2>
            <FaqList items={meta.faq} />
          </section>
        )}
        {cta && (
          <div className="mt-12 flex flex-wrap gap-3 border-t pt-8">
            <Button asChild>
              <Link href="/pricing">Start free trial</Link>
            </Button>
            <BookDemoButton />
          </div>
        )}
        {meta.related && meta.related.length > 0 && (
          <aside className="mt-10">
            <h2 className="text-lg font-semibold">Related Posts</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {meta.related.map((post) => (
                <li key={post.href}>
                  <Link
                    href={post.href}
                    className="block h-full rounded-xl border bg-card p-4 text-sm font-medium hover:border-primary"
                  >
                    {post.title}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </>
  );
}
