// Handling one verified Stripe webhook event (SYS-01, plan §6.5). The route
// at src/app/api/webhooks/stripe verifies the signature; this records the
// event (NFR-04), works out which subscription it concerns, and syncs it.

import { type Effect, type ProvisionDeps, syncSubscription, type SyncResult } from "./provision";

/** The parts of a Stripe event this reads. Stripe.Event satisfies it. */
export type EventLike = { id: string; type: string; data: { object: unknown } };

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  // PROV-08: renewals refresh the period end.
  "invoice.paid",
  // Recorded and synced; the failed-payment emails and banner arrive in
  // phase 7 (BILL-06).
  "invoice.payment_failed",
] as const;

export type WebhookOutcome =
  | { status: "duplicate" }
  | { status: "ignored" }
  | { status: "handled"; result: SyncResult; effects: Effect[] };

type Target = { subscriptionId: string; checkoutUserId: string | null } | null;

const idOf = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  return null;
};

/** The subscription an event concerns, and the buyer for a checkout. */
export function eventTarget(event: EventLike): Target {
  const object = (event.data.object ?? {}) as Record<string, unknown>;
  switch (event.type) {
    case "checkout.session.completed": {
      if (object.mode !== "subscription") return null;
      const subscriptionId = idOf(object.subscription);
      if (!subscriptionId) return null;
      const userId =
        typeof object.client_reference_id === "string" ? object.client_reference_id : null;
      return { subscriptionId, checkoutUserId: userId };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscriptionId = idOf(object.id);
      return subscriptionId ? { subscriptionId, checkoutUserId: null } : null;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      // Invoices without a subscription (one-off invoices) are ignored.
      const parent = object.parent as
        { subscription_details?: { subscription?: unknown } | null } | null | undefined;
      const subscriptionId = idOf(parent?.subscription_details?.subscription);
      return subscriptionId ? { subscriptionId, checkoutUserId: null } : null;
    }
    default:
      return null;
  }
}

export async function handleStripeEvent(
  deps: ProvisionDeps,
  event: EventLike,
): Promise<WebhookOutcome> {
  const claim = await deps.store.claimEvent(event.id, event.type);
  if (claim === "processed") return { status: "duplicate" };

  const target = eventTarget(event);
  if (!target) {
    await deps.store.markEventProcessed(event.id);
    return { status: "ignored" };
  }

  try {
    const result = await syncSubscription(
      deps,
      target.subscriptionId,
      target.checkoutUserId ? { userId: target.checkoutUserId } : null,
    );
    await deps.store.markEventProcessed(event.id);
    return { status: "handled", result, effects: result.status === "synced" ? result.effects : [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.store.markEventFailed(event.id, message.slice(0, 2000));
    throw error;
  }
}
