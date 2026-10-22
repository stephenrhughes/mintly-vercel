import Link from "next/link";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-1 flex-col items-start justify-center px-4 py-24 sm:px-6">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-3 text-muted-foreground">
          We couldn&apos;t find the page you were looking for.
        </p>
        <Button asChild className="mt-8">
          <Link href="/">Back to the home page</Link>
        </Button>
      </main>
      <SiteFooter />
    </>
  );
}
