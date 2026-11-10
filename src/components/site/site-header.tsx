import { ChevronDown, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AccountLinks } from "@/components/site/account-links";
import { isGroup, mainNav, type NavGroup } from "@/lib/marketing/nav";

// The sales menu (ported from mintly-web DemoNavbar.js). Dropdowns open on
// hover and keyboard focus with CSS alone, and the phone menu is a
// <details> element, so the header ships no JavaScript of its own.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Mintly home">
          <Image src="/brand/mintly-logo.svg" alt="Mintly" width={112} height={56} priority />
        </Link>
        <nav
          aria-label="Main"
          className="hidden flex-1 items-center gap-1 text-sm font-medium lg:flex"
        >
          {mainNav.map((item) =>
            isGroup(item) ? (
              <NavDropdown key={item.label} group={item} />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="hidden lg:block">
          <AccountLinks />
        </div>
        <MobileMenu />
      </div>
    </header>
  );
}

function NavDropdown({ group }: { group: NavGroup }) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-haspopup="true"
        className="flex items-center gap-1 rounded-md px-3 py-2 text-muted-foreground transition-colors group-focus-within:text-foreground group-hover:text-foreground"
      >
        {group.label}
        <ChevronDown className="size-3.5 transition-transform group-hover:rotate-180" aria-hidden />
      </button>
      <div className="invisible absolute top-full left-0 z-50 pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="flex w-max max-w-[44rem] gap-8 rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg">
          {group.sections.map((section, index) => (
            <div key={section.heading ?? index} className="min-w-48">
              {section.heading && (
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {section.heading}
                </p>
              )}
              <ul className="space-y-1">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block max-w-72 rounded-md px-2 py-1.5 hover:bg-accent focus-visible:bg-accent"
                    >
                      <span className="font-medium">{link.label}</span>
                      {link.description && (
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          {link.description}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileMenu() {
  return (
    <details className="group lg:hidden">
      <summary
        className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md hover:bg-accent [&::-webkit-details-marker]:hidden"
        aria-label="Menu"
      >
        <Menu className="size-5" aria-hidden />
      </summary>
      <div className="absolute inset-x-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b bg-background px-4 pt-2 pb-6 shadow-lg sm:px-6">
        <nav aria-label="Main" className="space-y-4 text-sm">
          {mainNav.map((item) =>
            isGroup(item) ? (
              <div key={item.label}>
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {item.label}
                </p>
                <ul>
                  {item.sections.flatMap((section) =>
                    section.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="block py-1.5 font-medium">
                          {link.label}
                        </Link>
                      </li>
                    )),
                  )}
                </ul>
              </div>
            ) : (
              <Link key={item.href} href={item.href} className="block py-1.5 font-medium">
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="mt-6 border-t pt-4">
          <AccountLinks />
        </div>
      </div>
    </details>
  );
}
