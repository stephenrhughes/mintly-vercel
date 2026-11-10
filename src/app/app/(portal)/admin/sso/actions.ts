"use server";

import type { ActionState } from "@/components/admin/ui";
import { adminAction, formText } from "@/lib/admin/action";
import { ssoDeps } from "@/lib/admin/server";
import { parseSsoDomain, removeSsoDomain, saveSsoDomain } from "@/lib/admin/sso";
import { normaliseDomain } from "@/lib/review/rules";

// SSO domains (plan §6.8, SSO-07), audited as sso.add, sso.update and
// sso.remove.

export async function saveSsoAction(
  isNew: boolean,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction("/admin/sso", async (admin) => {
    const parsed = parseSsoDomain({
      domain: formText(formData, "domain", 253),
      orgId: formText(formData, "orgId", 40),
      providerId: formText(formData, "providerId", 40),
      defaultRole: formText(formData, "defaultRole", 20),
      enabled: formData.get("enabled") === "on",
    });
    if (!parsed.ok) return { error: parsed.error };
    const r = await saveSsoDomain(ssoDeps(), { row: parsed.value, actorId: admin.id, isNew });
    return r.ok ? { message: r.message } : { error: r.error };
  });
}

export async function removeSsoAction(
  domain: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction("/admin/sso", async (admin) => {
    const d = normaliseDomain(domain);
    if (!d) return { error: "Not found." };
    if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm." };
    const r = await removeSsoDomain(ssoDeps(), { domain: d, actorId: admin.id });
    return r.ok ? { message: r.message } : { error: r.error };
  });
}
