import Link from "next/link";
import type { ReactNode } from "react";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { Button } from "@/components/ui/button";

/** The closing call to action on landing pages. */
export function CtaBand({
  title,
  lead,
  primary = { href: "/pricing", label: "Start Free Trial" },
  meeting = "api",
  showCall = true,
}: {
  title: ReactNode;
  lead?: ReactNode;
  primary?: { href: string; label: string } | null;
  meeting?: "api" | "eiscd";
  showCall?: boolean;
}) {
  return (
    <section className="bg-brand-navy text-white">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-balance">{title}</h2>
        {lead && <p className="mt-4 text-lg text-white/80">{lead}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {primary && (
            <Button
              asChild
              size="lg"
              className="bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
            >
              <Link href={primary.href}>{primary.label}</Link>
            </Button>
          )}
          {showCall && <BookDemoButton size="lg" variant="onDark" meeting={meeting} />}
        </div>
      </div>
    </section>
  );
}
