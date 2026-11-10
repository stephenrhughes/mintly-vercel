"use server";

import { redirect } from "next/navigation";

import { isUuid } from "@/lib/admin/action";
import { loadViewAsTarget, startViewAs } from "@/lib/admin/view-as";
import { requireAdmin } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";

// ADM-13: start viewing the portal as this user, audited.
export async function startViewAsAction(userId: string): Promise<void> {
  const admin = await requireAdmin(`/admin/view-as/${userId}`);
  if (!isUuid(userId)) redirect(appPath("/admin/organisations"));
  const target = await loadViewAsTarget(userId);
  if (!target || target.userId === admin.id) redirect(appPath("/admin/organisations"));
  await startViewAs(admin, target);
  redirect(appPath("/"));
}
