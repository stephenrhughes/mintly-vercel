import "server-only";

import type Stripe from "stripe";

import { apiKeyStore, disableKey, enableKey, keyNameFor, moveKey } from "@/lib/aws/apiKeys";
import { addContact, markTrialConverted, removeFromList } from "@/lib/brevo";
import { adminNotifyEmail, sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/hosts";
import { getDeploymentEnvironment } from "@/lib/site";
import { getPrice } from "@/lib/stripe/catalogue";
import { requireStripe } from "@/lib/stripe/client";
import { NewApiKeyEmail, newApiKeySubject } from "@/emails/new-api-key";
import { NewCustomerAdminEmail, newCustomerAdminSubject } from "@/emails/new-customer-admin";

import { isPlanTier, PLANS } from "./plans";
import type { Effect, KeyOps, ProvisionDeps, StripeOps } from "./provision";
import type { BillingStore } from "./store";
import { createSupabaseBillingStore } from "./store-supabase";
import { isLiveStatus, priceMeta } from "./subscription-record";

// Wires provisioning to the real services: Stripe, the AWS adapter and
// Supabase (service role). Used by the Stripe webhook only.

export function stripeOps(stripe: Stripe): StripeOps {
  return {
    retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
    async listLiveSubscriptionIds(customer) {
      const ids: string[] = [];
      for await (const sub of stripe.subscriptions.list({ customer, status: "all", limit: 100 })) {
        if (isLiveStatus(sub.status)) ids.push(sub.id);
      }
      return ids;
    },
    async cancelSubscription(id, comment) {
      await stripe.subscriptions.cancel(
        id,
        { cancellation_details: { comment } },
        { idempotencyKey: `replace-cancel-${id}` },
      );
    },
  };
}

const keyOps: KeyOps = {
  findKeyByName: (name) => apiKeyStore().findKeyByName(name),
  createKey: (input) => apiKeyStore().createKey(input),
  enableKey,
  disableKey,
  moveKey,
  keyNameFor,
};

export function provisionDeps(): ProvisionDeps {
  return {
    stripe: stripeOps(requireStripe()),
    store: createSupabaseBillingStore(),
    keys: keyOps,
    keyTags: { platform: "v2", env: getDeploymentEnvironment() },
  };
}

async function planName(priceId: string): Promise<string> {
  try {
    const price = await getPrice(priceId);
    const { tier } = priceMeta(price);
    if (isPlanTier(tier)) return PLANS[tier].name;
    return price.nickname ?? priceId;
  } catch {
    return priceId;
  }
}

/**
 * Runs the side effects of a webhook event, after the response (plan §6.5:
 * write the database first, then email and Brevo). A failure here is
 * logged, never retried: the provisioning it follows has already happened.
 */
export async function runEffects(
  effects: Effect[],
  store: BillingStore = createSupabaseBillingStore(),
) {
  for (const effect of effects) {
    try {
      switch (effect.type) {
        case "admin_new_customer":
          await sendEmail({
            to: adminNotifyEmail(),
            subject: newCustomerAdminSubject(effect.orgName),
            react: NewCustomerAdminEmail({
              orgName: effect.orgName,
              email: effect.email,
              planName: await planName(effect.stripePriceId),
              trialing: effect.trialing,
            }),
          });
          break;
        case "brevo_add":
          await addContact(effect.email);
          break;
        case "brevo_trial_converted":
          await markTrialConverted(effect.email);
          break;
        case "brevo_remove":
          await removeFromList(effect.email);
          break;
        case "new_key_notice": {
          const holders = await store.getKeyHolders(effect.orgId);
          await sendEmail({
            to: holders.map((person) => person.email),
            subject: newApiKeySubject,
            react: NewApiKeyEmail({
              orgName: effect.orgName,
              subscriptionUrl: appUrl("/subscription"),
            }),
          });
          break;
        }
      }
    } catch (error) {
      console.error(`webhook side effect ${effect.type} failed`, error);
    }
  }
}
