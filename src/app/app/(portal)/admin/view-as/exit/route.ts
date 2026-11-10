import { type NextRequest, NextResponse } from "next/server";

import { endViewAs } from "@/lib/admin/view-as";
import { requireAdmin } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";

// ADM-13, NAV-19: Exit ends the view-as session (audited) and returns to
// the organisation that was being viewed. A GET, so the banner's link works
// while every write is refused; ending a session is harmless.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin("/admin");
  const orgId = await endViewAs(admin);
  const target = orgId ? `/admin/organisations/${orgId}` : "/admin/organisations";
  return NextResponse.redirect(new URL(appPath(target), request.url), 303);
}
