import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Feature = { icon?: LucideIcon; title: ReactNode; text: ReactNode; tags?: string[] };

export function FeatureGrid({
  features,
  columns = 3,
  invert = false,
}: {
  features: Feature[];
  columns?: 2 | 3 | 4;
  invert?: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-10 grid gap-6 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
      )}
    >
      {features.map((feature, index) => (
        <div
          key={index}
          className={cn(
            "rounded-xl p-6",
            invert ? "bg-white/5 ring-1 ring-white/10" : "border bg-card shadow-xs",
          )}
        >
          {feature.icon && (
            <div
              className={cn(
                "mb-4 flex size-10 items-center justify-center rounded-lg",
                invert ? "bg-brand-mint/15 text-brand-mint" : "bg-secondary text-primary",
              )}
            >
              <feature.icon className="size-5" aria-hidden />
            </div>
          )}
          <h3 className="font-semibold">{feature.title}</h3>
          <div className={cn("mt-2 text-sm", invert ? "text-white/75" : "text-muted-foreground")}>
            {feature.text}
          </div>
          {feature.tags && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {feature.tags.map((tag) => (
                <li
                  key={tag}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    invert ? "bg-white/10" : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
