import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function Breadcrumb({ items, invert = false }: { items: Crumb[]; invert?: boolean }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm">
      <ol
        className={cn(
          "flex flex-wrap items-center gap-1",
          invert ? "text-white/70" : "text-muted-foreground",
        )}
      >
        <li>
          <Link href="/" className="hover:underline">
            Home
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" aria-hidden />
            {item.href ? (
              <Link href={item.href} className="hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className={invert ? "text-white" : "text-foreground"}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
