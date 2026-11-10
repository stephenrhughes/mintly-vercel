// The database operations provisioning needs, as an interface, so the
// webhook logic can be tested without Postgres (store-memory.ts) and run
// against Supabase with the service role (store-supabase.ts).

import type { ReviewStatus } from "@/lib/nav";

import type { KeyState } from "./key-plan";
import type { Product, SubscriptionRecord } from "./subscription-record";

export type OrgSummary = { id: string; name: string; reviewStatus: ReviewStatus };

export type StoredSubscription = {
  apiKeyId: string | null;
  trialing: boolean;
  expired: boolean;
  cancelAt: Date | null;
};

export type Person = { email: string; marketingOptOut: boolean };

export type EventClaim = "new" | "retry" | "processed";

export interface BillingStore {
  /** Records a Stripe event; "processed" means skip it (NFR-04). */
  claimEvent(id: string, type: string): Promise<EventClaim>;
  markEventProcessed(id: string): Promise<void>;
  markEventFailed(id: string, error: string): Promise<void>;

  /** Takes the provisioning lock for a subscription; false if another run holds it. */
  tryLock(key: string): Promise<boolean>;
  releaseLock(key: string): Promise<void>;

  findOrgByCustomer(stripeCustomerId: string): Promise<OrgSummary | null>;
  /** Creates the organisation and its owner, or returns the existing one (PROV-01). */
  provisionOrganisation(input: {
    name: string;
    stripeCustomerId: string;
    ownerId: string;
    reviewStatus: ReviewStatus;
    signupSignals: Record<string, unknown>;
  }): Promise<OrgSummary>;

  getSubscription(stripeSubscriptionId: string): Promise<StoredSubscription | null>;
  getKey(keyId: string): Promise<KeyState | null>;
  getKeyForItem(stripeSubscriptionItemId: string): Promise<KeyState | null>;
  /** Whether the organisation has had a key other than this one (BILL-08). */
  hasOtherKeys(orgId: string, keyId: string): Promise<boolean>;

  saveKey(input: {
    id: string;
    orgId: string;
    product: Product;
    stripeSubscriptionItemId: string | null;
    enabled: boolean;
    usagePlanId: string | null;
  }): Promise<void>;
  saveSubscription(input: {
    orgId: string;
    record: SubscriptionRecord;
    apiKeyId: string | null;
    keyNoticeAt: Date | null;
  }): Promise<void>;

  /** Marks a scheduled plan change done once Stripe has moved to its price (PLAN-04). */
  completeScheduledChange(orgId: string, priceId: string): Promise<void>;

  getProfile(
    userId: string,
  ): Promise<(Person & { companyName: string | null; phone: string | null }) | null>;
  getOwner(orgId: string): Promise<Person | null>;
  /** Owners and developers: the people who use the key (BILL-08). */
  getKeyHolders(orgId: string): Promise<Person[]>;
}
