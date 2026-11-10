import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "plain" | "muted" | "navy" | "mint";

const tones: Record<Tone, string> = {
  plain: "bg-background",
  muted: "bg-muted",
  navy: "bg-brand-navy text-white",
  mint: "bg-secondary",
};

/** A full-width band of the page with the standard content width. */
export function Section({
  children,
  tone = "plain",
  id,
  className,
  narrow = false,
}: {
  children: ReactNode;
  tone?: Tone;
  id?: string;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-16 sm:py-20", tones[tone], className)}>
      <div className={cn("mx-auto px-4 sm:px-6", narrow ? "max-w-3xl" : "max-w-6xl")}>
        {children}
      </div>
    </section>
  );
}

export function SectionHeading({
  title,
  lead,
  eyebrow,
  align = "left",
  as: Heading = "h2",
  invert = false,
}: {
  title: ReactNode;
  lead?: ReactNode;
  eyebrow?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  invert?: boolean;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <p
          className={cn(
            "mb-3 text-sm font-semibold tracking-wide uppercase",
            invert ? "text-brand-mint" : "text-primary",
          )}
        >
          {eyebrow}
        </p>
      )}
      <Heading className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </Heading>
      {lead && (
        <p className={cn("mt-4 text-lg", invert ? "text-white/80" : "text-muted-foreground")}>
          {lead}
        </p>
      )}
    </div>
  );
}
