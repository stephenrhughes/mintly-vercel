"use client";

import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  CircleUser,
  ClipboardCheck,
  CreditCard,
  ExternalLink,
  FileText,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessageSquare,
  Newspaper,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Tag,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, useSyncExternalStore } from "react";

import type { NavGroup, NavIcon } from "@/lib/nav";
import { cn } from "@/lib/utils";

const icons: Record<NavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  tools: Wrench,
  usage: BarChart3,
  key: KeyRound,
  docs: BookOpen,
  guides: FileText,
  releases: Newspaper,
  team: Users,
  billing: Receipt,
  subscription: CreditCard,
  account: Settings,
  reviews: ClipboardCheck,
  organisations: Building2,
  reports: ScrollText,
  plans: Tag,
  offers: BadgeCheck,
  sso: ShieldCheck,
  admins: CircleUser,
  feedback: MessageSquare,
};

export type SidebarUser = {
  email: string;
  roleLabel: string | null;
  orgName: string | null;
  orgStatus: string;
};

export type SidebarLinks = {
  home: string;
  account: string;
  signOut: string;
  supportEmail: string;
};

type SidebarProps = { groups: NavGroup[]; user: SidebarUser; links: SidebarLinks };

// The collapsed choice is remembered per browser (NAV-10). Storage can be
// unavailable; the sidebar then stays expanded and the choice isn't kept.
const COLLAPSED_KEY = "mintly.sidebar.collapsed";
const collapsedListeners = new Set<() => void>();

function subscribeCollapsed(listener: () => void) {
  collapsedListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    collapsedListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // Not remembered.
  }
  for (const listener of collapsedListeners) listener();
}

/**
 * The app menu: a permanent left sidebar on wide screens that can collapse
 * to icons (NAV-10), and a drawer opened from a labelled "Menu" button on
 * smaller screens (NAV-11). Hrefs arrive ready for this deployment.
 */
export function AppSidebar({ groups, user, links }: SidebarProps) {
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* Mobile and tablet top bar with the drawer (NAV-11). */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 lg:hidden">
        <Link href={links.home} aria-label="Mintly overview">
          <Image src="/brand/mintly-logo.svg" alt="Mintly" width={88} height={44} />
        </Link>
        <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-accent"
            >
              <Menu className="size-4" aria-hidden />
              Menu
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-background shadow-lg data-[state=open]:animate-in data-[state=open]:slide-in-from-left">
              <Dialog.Title className="sr-only">Menu</Dialog.Title>
              <Dialog.Description className="sr-only">The Mintly app menu</Dialog.Description>
              <div className="flex h-14 items-center justify-between border-b px-4">
                <OrgSummary user={user} collapsed={false} />
                <Dialog.Close className="rounded-md p-2 hover:bg-accent" aria-label="Close menu">
                  <X className="size-4" aria-hidden />
                </Dialog.Close>
              </div>
              <SidebarBody
                groups={groups}
                user={user}
                links={links}
                collapsed={false}
                onNavigate={() => setDrawerOpen(false)}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {/* Desktop sidebar: always visible from 1024px (NAV-10). */}
      <aside
        aria-label="App menu"
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-background transition-[width] lg:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex items-center border-b",
            collapsed ? "h-16 justify-center" : "h-16 px-4",
          )}
        >
          {collapsed ? (
            <Link
              href={links.home}
              aria-label="Mintly overview"
              className="font-semibold text-primary"
            >
              M
            </Link>
          ) : (
            <Link href={links.home} aria-label="Mintly overview">
              <Image src="/brand/mintly-logo.svg" alt="Mintly" width={96} height={48} priority />
            </Link>
          )}
        </div>
        <div className={cn("border-b py-3", collapsed ? "px-2" : "px-4")}>
          <OrgSummary user={user} collapsed={collapsed} />
        </div>
        <SidebarBody groups={groups} user={user} links={links} collapsed={collapsed} />
        <button
          type="button"
          onClick={() => writeCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className="flex h-10 items-center justify-center gap-2 border-t text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {collapsed ? (
            <>
              <ChevronsRight className="size-4" aria-hidden />
              <span className="sr-only">Expand menu</span>
            </>
          ) : (
            <>
              <ChevronsLeft className="size-4" aria-hidden />
              Collapse menu
            </>
          )}
        </button>
      </aside>
    </>
  );
}

/** Organisation name and status (NAV-15). */
function OrgSummary({ user, collapsed }: { user: SidebarUser; collapsed: boolean }) {
  const name = user.orgName ?? "Your account";
  if (collapsed) {
    return (
      <div
        title={`${name}: ${user.orgStatus}`}
        className="mx-auto flex size-8 items-center justify-center rounded-md bg-secondary text-sm font-semibold"
      >
        {name.charAt(0).toUpperCase()}
        <span className="sr-only">
          {name}: {user.orgStatus}
        </span>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold">{name}</p>
      <p className="text-xs text-muted-foreground">{user.orgStatus}</p>
    </div>
  );
}

function SidebarBody({
  groups,
  user,
  links,
  collapsed,
  onNavigate,
}: SidebarProps & { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <nav aria-label="Main" className="flex-1 overflow-y-auto py-3">
        {groups.map((group) => (
          <div key={group.id} className={cn("mb-4", collapsed ? "px-2" : "px-3")}>
            <h2
              className={cn(
                "mb-1 flex items-center gap-2 px-2 text-xs font-semibold tracking-wide uppercase",
                group.admin ? "text-admin" : "text-muted-foreground",
                collapsed && "sr-only",
              )}
            >
              {group.label}
              {group.admin ? (
                <span className="rounded bg-admin px-1.5 py-0.5 text-[10px] text-admin-foreground normal-case">
                  Admin
                </span>
              ) : null}
            </h2>
            <ul className="grid gap-0.5">
              {group.items.map((item) => {
                const Icon = icons[item.icon];
                const current =
                  !item.external && !item.href.includes("#") && item.href === pathname;
                const base = cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm",
                  collapsed && "justify-center px-0",
                );

                if (item.disabledReason) {
                  return (
                    <li key={item.id}>
                      <span
                        aria-disabled="true"
                        title={`${item.label}: ${item.disabledReason}`}
                        className={cn(base, "cursor-not-allowed text-muted-foreground/70")}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {collapsed ? (
                          <span className="sr-only">
                            {item.label} ({item.disabledReason})
                          </span>
                        ) : (
                          <span className="min-w-0">
                            <span className="block truncate">{item.label}</span>
                            <span className="block text-xs leading-snug">
                              {item.disabledReason}
                            </span>
                          </span>
                        )}
                      </span>
                    </li>
                  );
                }

                const content = (
                  <>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
                    {item.external && !collapsed ? (
                      <ExternalLink className="ml-auto size-3 text-muted-foreground" aria-hidden />
                    ) : null}
                  </>
                );
                const className = cn(
                  base,
                  current
                    ? group.admin
                      ? "bg-admin/10 font-medium text-admin"
                      : "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                );

                return (
                  <li key={item.id}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className={className}
                        title={collapsed ? item.label : undefined}
                        onClick={onNavigate}
                      >
                        {content}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        aria-current={current ? "page" : undefined}
                        className={className}
                        title={collapsed ? item.label : undefined}
                        onClick={onNavigate}
                      >
                        {content}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* The user menu (NAV-16). */}
      <div className={cn("border-t py-3", collapsed ? "px-2" : "px-3")}>
        {collapsed ? null : (
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium" title={user.email}>
              {user.email}
            </p>
            {user.roleLabel ? (
              <p className="text-xs text-muted-foreground">{user.roleLabel}</p>
            ) : null}
          </div>
        )}
        <ul className="grid gap-0.5 text-sm">
          <li>
            <Link
              href={links.account}
              onClick={onNavigate}
              title={collapsed ? "Account settings" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <CircleUser className="size-4" aria-hidden />
              <span className={cn(collapsed && "sr-only")}>Account settings</span>
            </Link>
          </li>
          <li>
            <a
              href={`mailto:${links.supportEmail}`}
              title={collapsed ? "Help" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <LifeBuoy className="size-4" aria-hidden />
              <span className={cn(collapsed && "sr-only")}>Help: {links.supportEmail}</span>
            </a>
          </li>
          <li>
            <form action={links.signOut} method="post">
              <button
                type="submit"
                title={collapsed ? "Sign out" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <LogOut className="size-4" aria-hidden />
                <span className={cn(collapsed && "sr-only")}>Sign out</span>
              </button>
            </form>
          </li>
        </ul>
      </div>
    </>
  );
}
