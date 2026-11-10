import type { ReactNode } from "react";

import { Breadcrumb, type Crumb } from "@/components/site/breadcrumb";
import { cn } from "@/lib/utils";

/** The navy band at the top of each landing page. */
export function PageHero({
  title,
  lead,
  eyebrow,
  actions,
  aside,
  crumbs,
  children,
  compact = false,
}: {
  title: ReactNode;
  lead?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  crumbs?: Crumb[];
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className="bg-brand-navy text-white">
      <div
        className={cn(
          "mx-auto grid max-w-6xl gap-10 px-4 sm:px-6",
          compact ? "py-12 sm:py-16" : "py-16 sm:py-24",
          aside && "lg:grid-cols-[1.15fr_1fr] lg:items-center",
        )}
      >
        <div>
          {crumbs && <Breadcrumb items={crumbs} invert />}
          {eyebrow && (
            <p className="mb-4 text-sm font-semibold tracking-wide text-brand-mint uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
          {lead && <div className="mt-6 max-w-2xl text-lg text-white/80">{lead}</div>}
          {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
          {children}
        </div>
        {aside && <div>{aside}</div>}
      </div>
    </section>
  );
}
