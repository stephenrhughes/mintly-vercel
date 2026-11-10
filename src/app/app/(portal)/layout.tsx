import { Suspense } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { ViewAsBanner } from "@/components/app/view-as-banner";
import { requirePortalViewer } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";
import { buildNav, orgStatusLabel, roleLabels } from "@/lib/nav";
import { siteConfig } from "@/lib/site";

// The app layout (LAY-01, LAY-03): a permanent left sidebar and the page.
// No marketing header, footer or banners.
export default function PortalLayout({ children }: LayoutProps<"/app">) {
  return (
    <>
      <a
        href="#content"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="flex min-h-full flex-1 flex-col bg-app-surface lg:flex-row">
        <Suspense fallback={<SidebarPlaceholder />}>
          <PortalSidebar />
        </Suspense>
        <main id="content" className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-10">
          <div className="mx-auto max-w-5xl">
            <Suspense fallback={null}>
              <ViewAsBanner />
            </Suspense>
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

async function PortalSidebar() {
  const user = await requirePortalViewer();
  const membership = user.membership;
  const groups = buildNav({
    role: membership?.role ?? null,
    reviewStatus: membership?.reviewStatus ?? null,
    isMintlyAdmin: user.isMintlyAdmin,
  }).map((group) => ({
    ...group,
    items: group.items.map((item) =>
      item.external ? item : { ...item, href: appPath(item.href) },
    ),
  }));

  return (
    <AppSidebar
      groups={groups}
      user={{
        email: user.email,
        roleLabel: membership
          ? roleLabels[membership.role]
          : user.isMintlyAdmin
            ? "Mintly admin"
            : null,
        orgName: membership?.orgName ?? null,
        orgStatus: orgStatusLabel(membership?.reviewStatus ?? null),
      }}
      links={{
        home: appPath("/"),
        account: appPath("/account"),
        signOut: appPath("/sign-out"),
        supportEmail: siteConfig.supportEmail,
      }}
    />
  );
}

function SidebarPlaceholder() {
  return (
    <>
      <div className="h-14 border-b bg-background lg:hidden" />
      <div className="hidden h-svh w-64 shrink-0 border-r bg-background lg:block" />
    </>
  );
}
