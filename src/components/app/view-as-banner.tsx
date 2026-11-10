import { Eye } from "lucide-react";

import { getViewAsSession, requirePortalViewer } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";

import { ReadOnlyForms } from "./read-only-forms";

// NAV-19, ADM-13: while an admin views the portal as a customer, a banner
// that can't be missed says whose portal it is, and offers Exit. Every
// form on the page is made inert; src/proxy.ts refuses writes regardless.
export async function ViewAsBanner() {
  const session = await getViewAsSession();
  if (!session) return null;
  const viewer = await requirePortalViewer();
  if (!viewer.viewAs) return null;
  const name = [viewer.firstName, viewer.lastName].filter(Boolean).join(" ");
  return (
    <div
      role="status"
      className="sticky top-0 z-40 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-admin/40 bg-admin px-4 py-3 text-sm text-admin-foreground shadow-sm sm:-mx-8 sm:px-8"
    >
      <Eye className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        Viewing as <strong>{name || viewer.email}</strong>
        {name ? ` (${viewer.email})` : ""}
        {viewer.membership ? `, ${viewer.membership.orgName}` : ", no organisation"}. Read-only:
        nothing can be changed and the API key is hidden.
      </p>
      <a
        href={appPath("/admin/view-as/exit")}
        className="rounded-md bg-admin-foreground px-3 py-1.5 font-medium text-admin hover:opacity-90"
      >
        Exit
      </a>
      <ReadOnlyForms />
    </div>
  );
}
