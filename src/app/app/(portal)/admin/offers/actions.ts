"use server";

import type { ActionState } from "@/components/admin/ui";
import { adminAction, confirmed, formText, isUuid } from "@/lib/admin/action";
import { createOffer, revokeOffer } from "@/lib/admin/offers";
import { readPriceChoice } from "@/lib/admin/price-form";
import { offerDeps } from "@/lib/admin/setup-server";

// Offers (ADM-11): create and withdraw, audited.

export async function createOfferAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction("/admin/offers", async (admin) => {
    const orgId = formText(formData, "orgId", 40);
    const email = formText(formData, "email", 254);
    const expires = formText(formData, "expiresAt", 20);
    const r = await createOffer(
      offerDeps(),
      {
        target: formText(formData, "target") === "email" ? { email } : { orgId },
        price: readPriceChoice(formData),
        headline: formText(formData, "headline", 200),
        message: formText(formData, "message", 2000),
        expiresAt: new Date(`${expires}T23:59:00Z`),
        nonce: formText(formData, "nonce", 40),
      },
      admin.id,
    );
    return r.ok ? { message: r.message } : { error: r.error };
  });
}

export async function revokeOfferAction(
  offerId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction("/admin/offers", async (admin) => {
    if (!isUuid(offerId)) return { error: "Not found." };
    if (!confirmed(formData)) return { error: "Tick the box to confirm." };
    const r = await revokeOffer(offerDeps(), { offerId, actorId: admin.id });
    return r.ok ? { message: r.message } : { error: r.error };
  });
}
