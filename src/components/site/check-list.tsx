import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function CheckList({
  items,
  className,
  invert = false,
}: {
  items: ReactNode[];
  className?: string;
  invert?: boolean;
}) {
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item, index) => (
        <li key={index} className="flex gap-2">
          <CheckCircle2
            className={cn("mt-0.5 size-5 shrink-0", invert ? "text-brand-mint" : "text-primary")}
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
