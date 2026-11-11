"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type FaqCategory, type FaqEntry, plainText } from "@/content/faq";
import { track } from "@/lib/analytics";
import { SUPPORT_EMAIL } from "@/lib/marketing/contact";
import { cn } from "@/lib/utils";

// The searchable, filterable FAQ (ported from mintly-web pages/faq.js).
// Every answer is in the server-rendered HTML; search only hides them.
const ALL = "all";
const AUTO_OPEN_LIMIT = 3;
const SEARCH_EVENT_DELAY_MS = 1000;
const MIN_SEARCH_EVENT_LENGTH = 3;

const tokenise = (query: string) =>
  query
    .toLowerCase()
    .split(/[^a-z0-9£]+/i)
    .filter(Boolean);

export function FaqExplorer({ faqs, categories }: { faqs: FaqEntry[]; categories: FaqCategory[] }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState(ALL);
  const [open, setOpen] = useState<string[]>([]);

  const haystacks = useMemo(
    () =>
      new Map(
        faqs.map((faq) => [
          faq.id,
          [faq.question, faq.keywords, plainText(faq.answer)].join(" ").toLowerCase(),
        ]),
      ),
    [faqs],
  );
  const terms = useMemo(() => tokenise(query), [query]);
  const searching = terms.length > 0;
  // Every term must appear, so "iban germany" narrows rather than widens.
  const found = useMemo(
    () => faqs.filter((faq) => terms.every((term) => haystacks.get(faq.id)!.includes(term))),
    [faqs, terms, haystacks],
  );
  const counts = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const faq of found) totals[faq.category] = (totals[faq.category] ?? 0) + 1;
    return totals;
  }, [found]);
  const visible = topic === ALL ? found : found.filter((faq) => faq.category === topic);
  const groups = categories
    .map((category) => ({
      ...category,
      items: visible.filter((faq) => faq.category === category.id),
    }))
    .filter((group) => group.items.length > 0);

  // A search that lands on one or two answers shows them straight away.
  const autoOpen = searching && found.length <= AUTO_OPEN_LIMIT ? found.map((faq) => faq.id) : [];
  const isOpen = (id: string) => open.includes(id) || autoOpen.includes(id);

  // Deep links: /faq#confirmation-of-payee opens that answer.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (faqs.some((faq) => faq.id === id)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL hash once on load
      setOpen([id]);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  }, [faqs]);

  // Report searches once typing stops; empty results are the useful signal.
  useEffect(() => {
    if (query.trim().length < MIN_SEARCH_EVENT_LENGTH) return undefined;
    const timer = setTimeout(
      () =>
        track("faq_search", {
          category: "FAQ",
          label: query.trim().toLowerCase(),
          value: found.length,
        }),
      SEARCH_EVENT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [query, found.length]);

  const summary = !searching
    ? `${faqs.length} answers, grouped by topic.`
    : found.length === 0
      ? `No answers match “${query.trim()}”.`
      : `${found.length} of ${faqs.length} answers match “${query.trim()}”.`;

  const chooseTopic = (id: string) => {
    setTopic(id);
    setOpen([]);
    track("faq_topic", { category: "FAQ", label: id });
  };

  return (
    <div>
      <div className="relative max-w-xl">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          aria-label="Search the FAQ"
          placeholder="Search - try “IBAN”, “rate limit”, “cancel”"
          className="h-11 pr-10 pl-9"
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear the search"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
            onClick={() => setQuery("")}
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Topics">
        <Button
          size="sm"
          variant={topic === ALL ? "default" : "outline"}
          aria-pressed={topic === ALL}
          onClick={() => chooseTopic(ALL)}
        >
          All topics <span className="opacity-70">{found.length}</span>
        </Button>
        {categories.map((category) => (
          <Button
            key={category.id}
            size="sm"
            variant={topic === category.id ? "default" : "outline"}
            aria-pressed={topic === category.id}
            disabled={(counts[category.id] ?? 0) === 0}
            onClick={() => chooseTopic(category.id)}
          >
            {category.title} <span className="opacity-70">{counts[category.id] ?? 0}</span>
          </Button>
        ))}
      </div>
      <p aria-live="polite" className="mt-4 text-sm text-muted-foreground">
        {summary}
      </p>

      {groups.map((group) => (
        <section key={group.id} className="mt-8">
          <h3 className="text-xl font-semibold">{group.title}</h3>
          <p className="text-sm text-muted-foreground">{group.blurb}</p>
          <div className="mt-4 divide-y rounded-xl border bg-card">
            {group.items.map((faq) => (
              <details
                key={faq.id}
                id={faq.id}
                open={isOpen(faq.id)}
                className="group scroll-mt-24 p-5"
                onToggle={(event) => {
                  const nowOpen = (event.currentTarget as HTMLDetailsElement).open;
                  if (nowOpen === isOpen(faq.id)) return;
                  if (nowOpen) track("faq_opened", { category: "FAQ", label: faq.id });
                  setOpen((ids) =>
                    nowOpen ? [...ids, faq.id] : ids.filter((id) => id !== faq.id),
                  );
                }}
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  <h4>{faq.question}</h4>
                  <span
                    aria-hidden
                    className="text-xl leading-none text-primary transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <div
                  className={cn(
                    "prose prose-sm mt-3 max-w-none text-muted-foreground prose-h3:text-base prose-a:text-primary",
                  )}
                  dangerouslySetInnerHTML={{ __html: faq.answer }}
                />
              </details>
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <div className="mt-8 rounded-xl border bg-card p-6">
          <h3 className="font-semibold">Nothing matched that</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different word, or ask us directly - we answer questions like this all day.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setTopic(ALL);
              }}
            >
              Clear the search
            </Button>
            <Button asChild variant="ghost">
              <a href={`mailto:${SUPPORT_EMAIL}`}>Email {SUPPORT_EMAIL}</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
