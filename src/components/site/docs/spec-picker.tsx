import Link from "next/link";

import { docsPathFor, type EiscdSpec, FREQUENCIES, resolveCombo, VERSIONS } from "@/lib/docs/specs";
import { cn } from "@/lib/utils";

/** Switch between the EISCD references. Combinations with no spec have no link. */
export function SpecPicker({ current }: { current: EiscdSpec }) {
  const pill = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium",
      active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent",
    );
  return (
    <nav aria-label="EISCD API versions" className="border-b bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Plan:</span>
          {FREQUENCIES.map(({ id, label }) => {
            const target = resolveCombo(id, current.version);
            return target ? (
              <Link key={id} href={target.path} aria-current={current.frequency === id ? "page" : undefined} className={pill(current.frequency === id)}>
                {label}
              </Link>
            ) : null;
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Version:</span>
          {VERSIONS.map(({ id, label }) => {
            const exists = resolveCombo(current.frequency, id)?.version === id;
            if (!exists) {
              return (
                <span key={id} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground/60" aria-disabled>
                  {label}
                </span>
              );
            }
            return (
              <Link
                key={id}
                href={docsPathFor(current.frequency, id)}
                aria-current={current.version === id ? "page" : undefined}
                className={pill(current.version === id)}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
