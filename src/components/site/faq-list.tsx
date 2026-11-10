import type { FaqItem } from "@/lib/marketing/json-ld";

/** Questions as native disclosure widgets; answers are trusted HTML from our own copy. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="mt-8 divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <details key={item.question} className="group p-5">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
            {item.question}
            <span aria-hidden className="text-primary transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <div
            className="prose prose-sm mt-3 max-w-none text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: item.answer }}
          />
        </details>
      ))}
    </div>
  );
}
