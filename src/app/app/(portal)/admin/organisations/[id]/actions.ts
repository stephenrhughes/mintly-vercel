"use server";

import type { ActionState } from "@/components/admin/ui";
import { adminAction, formText, isUuid } from "@/lib/admin/action";
import { applyResync, previewResync } from "@/lib/admin/resync-apply";
import { describeKeyAction } from "@/lib/admin/resync";
import { resyncDeps } from "@/lib/admin/resync-server";

// Resync from Stripe (ADM-05, ADM-07): preview, then apply.

export type ResyncState = ActionState & {
  preview?: {
    fingerprint: string;
    changes: Array<{ label: string; stored: string | null; expected: string | null }>;
    keyActions: string[];
    blockers: string[];
  };
};

const validSubscriptionId = (id: string) => /^sub_[A-Za-z0-9]+$/.test(id);

export async function previewResyncAction(
  orgId: string,
  subscriptionId: string,
): Promise<ResyncState> {
  if (!isUuid(orgId) || !validSubscriptionId(subscriptionId)) return { error: "Not found." };
  let preview: ResyncState["preview"];
  const state = await adminAction(`/admin/organisations/${orgId}`, async () => {
    const result = await previewResync(resyncDeps(), { orgId, subscriptionId });
    if (!result.ok) return { error: result.error };
    preview = {
      fingerprint: result.plan.fingerprint,
      changes: result.plan.changes,
      keyActions: result.plan.keyActions.map(describeKeyAction),
      blockers: result.blockerMessages,
    };
    return {};
  });
  return { ...state, preview };
}

export async function applyResyncAction(
  orgId: string,
  subscriptionId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isUuid(orgId) || !validSubscriptionId(subscriptionId)) return { error: "Not found." };
  return adminAction(`/admin/organisations/${orgId}`, async (admin) => {
    const result = await applyResync(resyncDeps(), {
      orgId,
      subscriptionId,
      fingerprint: formText(formData, "fingerprint", 100),
      actorId: admin.id,
    });
    return result.ok ? { message: result.message } : { error: result.error };
  });
}
