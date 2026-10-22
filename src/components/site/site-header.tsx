import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

const nav = [
  { href: "/#products", label: "Products" },
  { href: "/#why-mintly", label: "Why Mintly" },
  { href: "/#developers", label: "Developers" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center" aria-label="Mintly home">
          <Image src="/brand/mintly-logo.svg" alt="Mintly" width={112} height={56} priority />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm font-medium md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Button asChild size="sm">
          <a href={`mailto:${siteConfig.supportEmail}`}>Contact us</a>
        </Button>
      </div>
    </header>
  );
}
