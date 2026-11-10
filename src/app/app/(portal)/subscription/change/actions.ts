"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { canManageBilling } from "@/lib/billing/permissions";
import { applyChange, cancelScheduledChange } from "@/lib/billing/plan-change";
import { cardSetupUrl, loadChangeContext, planChangeDeps } from "@/lib/billing/plan-change-server";
import { isBillingInterval, isPlanTier } from "@/lib/billing/plans";
import { appPath } from "@/lib/hosts";
import { siteConfig } from "@/lib/site";

export type ChangeState = { error?: string };

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

// PLAN-01 to PLAN-05: the owner confirms a quoted change.
export async function confirmPlanChange(
  _state: ChangeState,
  formData: FormData,
): Promise<ChangeState> {
  const user = await requireUser("/subscription/change");
  if (!canManageBilling(user.membership))
    return { error: "Only your account owner can change plan." };

  const tier = text(formData, "tier");
  const interval = text(formData, "interval");
  const mode = text(formData, "mode") === "start_paid" ? "start_paid" : "switch";
  const prorationDate = Number.parseInt(text(formData, "prorationDate"), 10);
  const nonce = text(formData, "nonce");
  if (
    !isPlanTier(tier) ||
    !isBillingInterval(interval) ||
    !Number.isFinite(prorationDate) ||
    !/^[0-9a-f-]{36}$/.test(nonce)
  ) {
    return { error: "Choose a plan first." };
  }

  const ctx = await loadChangeContext(user.membership!.orgId);
  if (!ctx) return { error: "Your organisation has no live subscription to change." };

  let result;
  try {
    result = await applyChange(
      planChangeDeps(),
      ctx,
      { tier, interval, mode },
      {
        actorId: user.id,
        actorKind: "owner",
        prorationDate,
        nonce,
      },
    );
  } catch (error) {
    console.error("plan change failed", error);
    return {
      error: `Something went wrong, and your plan may not have changed. Check your subscription, or email ${siteConfig.supportEmail}.`,
    };
  }

  if (!result.ok && "needsCard" in result) {
    redirect(await cardSetupUrl({ orgId: ctx.orgId, tier, interval }));
  }
  if (!result.ok) return { error: result.error };
  redirect(appPath(`/subscription?changed=${result.kind}`));
}

// PLAN-04: cancel a scheduled downgrade.
export async function cancelPlanChange(): Promise<void> {
  const user = await requireUser("/subscription/change");
  if (!canManageBilling(user.membership)) return;
  await cancelScheduledChange(planChangeDeps(), { orgId: user.membership!.orgId });
  redirect(appPath("/subscription?changed=cancelled"));
}
