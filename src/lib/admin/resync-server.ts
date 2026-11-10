import "server-only";

import {
  addKeyToPlan,
  describeKey,
  getKeyPlans,
  removeKeyFromPlan,
  setKeyEnabled,
} from "@/lib/aws/apiKeys";
import { provisionDeps } from "@/lib/billing/server";
import { syncSubscription } from "@/lib/billing/provision";
import { deriveSubscriptionRecord } from "@/lib/billing/subscription-record";
import type { ReviewStatus } from "@/lib/nav";
import { requireStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/admin";

import { auditSink } from "./audit";
import type { ResyncDeps } from "./resync-apply";
import {
  KEY_COLUMNS,
  type KeyDbRow,
  SUBSCRIPTION_COLUMNS,
  type SubscriptionDbRow,
  toStoredKey,
  toStoredRow,
} from "./rows";

// Wires the resync to Supabase (service role), Stripe and the AWS adapter.
// Callers have already passed requireAdmin().

function isMissing(error: unknown): boolean {
  const e = error as { statusCode?: number; code?: string } | null;
  return e?.statusCode === 404 || e?.code === "resource_missing";
}

export function resyncDeps(): ResyncDeps {
  const db = createServiceClient();
  return {
    async load(orgId, subscriptionId) {
      const org = await db
        .from("organisations")
        .select("id, name, stripe_customer_id, review_status")
        .eq("id", orgId)
        .maybeSingle<{
          id: string;
          name: string;
          stripe_customer_id: string | null;
          review_status: ReviewStatus;
        }>();
      if (org.error) throw new Error(`reading the organisation failed: ${org.error.message}`);
      if (!org.data) return null;

      const sub = await db
        .from("subscriptions")
        .select(SUBSCRIPTION_COLUMNS)
        .eq("org_id", orgId)
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle<SubscriptionDbRow>();
      if (sub.error) throw new Error(`reading the subscription failed: ${sub.error.message}`);
      const stored = sub.data ? toStoredRow(sub.data) : null;

      let key = null;
      if (stored?.apiKeyId) {
        const row = await db
          .from("api_keys")
          .select(`${KEY_COLUMNS}, disabled_by_admin`)
          .eq("id", stored.apiKeyId)
          .maybeSingle<KeyDbRow>();
        if (row.error) throw new Error(`reading the key failed: ${row.error.message}`);
        key = row.data ? toStoredKey(row.data) : null;
      }
      return {
        orgId,
        orgName: org.data.name,
        orgStripeCustomerId: org.data.stripe_customer_id,
        reviewStatus: org.data.review_status,
        stored,
        key,
      };
    },
    async retrieveLive(subscriptionId) {
      try {
        return deriveSubscriptionRecord(
          await requireStripe().subscriptions.retrieve(subscriptionId),
        );
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async awsKey(keyId) {
      const info = await describeKey(keyId);
      if (!info) return { exists: false, enabled: false, plans: [] };
      return { exists: true, enabled: info.enabled, plans: await getKeyPlans(keyId) };
    },
    keys: {
      addToPlan: addKeyToPlan,
      removeFromPlan: removeKeyFromPlan,
      setEnabled: setKeyEnabled,
    },
    async saveKeyRow(keyId, state) {
      const { error } = await db
        .from("api_keys")
        .update({ enabled: state.enabled, usage_plan_id: state.usagePlanId })
        .eq("id", keyId);
      if (error) throw new Error(`saving the key failed: ${error.message}`);
    },
    async syncSubscription(subscriptionId) {
      // Effects (emails, Brevo) belong to Stripe events, not to a resync.
      await syncSubscription(provisionDeps(), subscriptionId, null);
    },
    audit: auditSink(db),
  };
}
