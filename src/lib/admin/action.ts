import "server-only";

import { refresh } from "next/cache";

import type { ActionState } from "@/components/admin/ui";
import { type AppUser, requireAdmin } from "@/lib/auth/session";

import { errorText } from "./audit";

// The frame every admin Server Action runs in (plan §6.8): an admin who has
// completed MFA (SEC-01) first, then the task, then a refresh of the page.
// requireAdmin() stays outside the try, so its redirect or 404 isn't
// swallowed.

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const formText = (formData: FormData, name: string, max = 2000) =>
  String(formData.get(name) ?? "")
    .trim()
    .slice(0, max);

export const confirmed = (formData: FormData, name = "confirm") => formData.get(name) === "on";

export async function adminAction(
  next: string,
  task: (admin: AppUser) => Promise<ActionState>,
): Promise<ActionState> {
  const admin = await requireAdmin(next);
  let state: ActionState;
  try {
    state = await task(admin);
  } catch (error) {
    console.error(`admin action on ${next} failed`, error);
    state = { error: `Something went wrong: ${errorText(error)}` };
  }
  refresh();
  return state;
}
