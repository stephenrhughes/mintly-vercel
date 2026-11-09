import { after } from "next/server";

import { MissingPlanMetadataError, ProvisioningBusyError } from "@/lib/billing/provision";
import { provisionDeps, runEffects } from "@/lib/billing/server";
import { handleStripeEvent } from "@/lib/billing/webhook";
import { getStripe } from "@/lib/stripe/client";

// The Stripe webhook (SYS-01, plan §6.5). Register it in Stripe with the
// events in HANDLED_EVENTS (src/lib/billing/webhook.ts); see
// docs/stripe-setup.md.
//
// Status codes matter: anything but 2xx makes Stripe retry with backoff.
// That is what we want for a price missing its metadata (PROV-10), a
// concurrent event (ProvisioningBusyError) and any other failure.

export const maxDuration = 60;

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    return Response.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  // The signature covers the raw body, so read it as text (PROV-10).
  const body = await request.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const deps = provisionDeps();
    const outcome = await handleStripeEvent(deps, event);
    if (outcome.status === "handled" && outcome.effects.length > 0) {
      after(() => runEffects(outcome.effects, deps.store));
    }
    console.info(
      JSON.stringify({
        msg: "stripe webhook",
        event: event.id,
        type: event.type,
        outcome: outcome.status,
      }),
    );
    return Response.json({ received: true, outcome: outcome.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        msg: "stripe webhook failed",
        event: event.id,
        type: event.type,
        error: message,
      }),
    );
    const status = error instanceof ProvisioningBusyError ? 409 : 500;
    const reason =
      error instanceof MissingPlanMetadataError || error instanceof ProvisioningBusyError
        ? message
        : "Webhook handling failed";
    return Response.json({ error: reason }, { status });
  }
}
