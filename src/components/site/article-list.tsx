"use client";

import Link from "next/link";
import { useState } from "react";

import type { ArticleCard } from "@/content/articles";

/** Article cards with the old tag filter. Every card is in the static HTML. */
export function ArticleList({ articles, tags }: { articles: ArticleCard[]; tags: string[] }) {
  const [tag, setTag] = useState("all");
  const shown =
    tag === "all"
      ? articles
      : articles.filter((a) => a.tags.includes(tag as ArticleCard["tags"][number]));
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Articles</h2>
        <label className="flex items-center gap-2 text-sm">
          Filter by tag:
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5"
          >
            <option value="all">All</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((article) => (
          <li key={article.href}>
            <Link
              href={article.href}
              className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary"
            >
              <h3 className="font-semibold text-primary">{article.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{article.description}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {article.tags.map((t) => (
                  <li key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {t}
                  </li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
