"use server";

import type { ActionState } from "@/components/admin/ui";
import { adminAction, formText, isUuid } from "@/lib/admin/action";
import { findProfileByEmail } from "@/lib/admin/server";
import { createServiceClient } from "@/lib/supabase/admin";

// Grant or revoke Mintly admin (plan §6.8). set_mintly_admin() refuses to
// remove the last admin and audits the change in the same transaction. A
// new admin sets up an authenticator app the first time they open /admin
// (SEC-01).

async function setAdmin(
  userId: string,
  isAdmin: boolean,
  actorId: string,
): Promise<ActionState | null> {
  const { error } = await createServiceClient().rpc("set_mintly_admin", {
    p_user_id: userId,
    p_is_admin: isAdmin,
    p_actor_id: actorId,
  });
  if (!error) return null;
  if (error.code === "P0001") return { error: "There must always be at least one Mintly admin." };
  if (error.code === "P0002") return { error: "That person no longer exists." };
  throw new Error(error.message);
}

export async function grantAdmin(_state: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("/admin/admins", async (admin) => {
    const email = formText(formData, "email", 254);
    if (!email.includes("@")) return { error: "Enter the email address they sign in with." };
    const person = await findProfileByEmail(email);
    if (!person) {
      return { error: `Nobody signs in as ${email}. Ask them to create an account first.` };
    }
    if (person.isMintlyAdmin) return { error: `${person.email} is already an admin.` };
    const refused = await setAdmin(person.id, true, admin.id);
    if (refused) return refused;
    return {
      message: `${person.email} is now a Mintly admin. They'll be asked to set up an authenticator app before they can open the admin area.`,
    };
  });
}

export async function revokeAdmin(
  userId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction("/admin/admins", async (admin) => {
    if (!isUuid(userId)) return { error: "Not found." };
    if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm." };
    const refused = await setAdmin(userId, false, admin.id);
    if (refused) return refused;
    return {
      message: userId === admin.id ? "You're no longer an admin." : "They're no longer an admin.",
    };
  });
}
