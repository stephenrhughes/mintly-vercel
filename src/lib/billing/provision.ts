// Provisioning from Stripe (plan §6.5, PROV-01 to PROV-10). Every webhook
// event that concerns a subscription ends up in syncSubscription, which reads
// the subscription fresh from Stripe and brings the database and the API key
// in line with it. Because it works from Stripe's current state rather than
// the event payload, events can arrive late, twice or out of order (NFR-04).
//
// Order matters (plan §6.5): read Stripe, apply key actions through the AWS
// adapter, write the database last, then return the side effects (email,
// Brevo) for the caller to run after the response.

import type { ReviewStatus } from "@/lib/nav";

import { type KeyAction, type KeyState, planKeyActions } from "./key-plan";
import type { BillingStore, OrgSummary, StoredSubscription } from "./store";
import {
  deriveSubscriptionRecord,
  isLiveStatus,
  priceMeta,
  subscriptionItem,
  type SubscriptionLike,
  type SubscriptionRecord,
  UPGRADE_CANCELLATION_COMMENT,
} from "./subscription-record";

/** A price without the usage plan metadata the webhook relies on (PROV-10). */
export class MissingPlanMetadataError extends Error {
  constructor(priceId: string) {
    super(
      `Price ${priceId} is missing usagePlanId or trialUsagePlanId metadata. Add it in Stripe; the event will be retried.`,
    );
    this.name = "MissingPlanMetadataError";
  }
}

/** Another run is provisioning this subscription; Stripe retries the event later. */
export class ProvisioningBusyError extends Error {
  constructor(subscriptionId: string) {
    super(`Subscription ${subscriptionId} is being provisioned by another event; retry later.`);
    this.name = "ProvisioningBusyError";
  }
}

/** The key operations provisioning uses: src/lib/aws/apiKeys.ts in the app. */
export type KeyOps = {
  findKeyByName(name: string): Promise<{ id: string } | null>;
  createKey(input: {
    name: string;
    usagePlanId: string;
    tags: Record<string, string>;
  }): Promise<{ id: string }>;
  enableKey(keyId: string, usagePlanId: string): Promise<void>;
  disableKey(keyId: string, usagePlanId: string | null): Promise<void>;
  moveKey(keyId: string, from: string | null, to: string): Promise<void>;
  keyNameFor(subscriptionItemId: string): string;
};

/** The Stripe calls provisioning uses. Stripe's SDK satisfies it through stripeOps(). */
export type StripeOps = {
  retrieveSubscription(id: string): Promise<SubscriptionLike>;
  listLiveSubscriptionIds(customerId: string): Promise<string[]>;
  cancelSubscription(id: string, comment: string): Promise<void>;
};

/** What trial review needs to know about a new organisation's checkout (plan §6.11). */
export type NewTrialInput = {
  ownerEmail: string;
  companyName: string | null;
  phone: string | null;
  stripePriceId: string;
  tier: string | null;
  interval: string | null;
  trialing: boolean;
  /** The subscription's metadata, including the checkout's request signals. */
  metadata: Record<string, string>;
};

/** Decides whether a new organisation is reviewed: src/lib/review/decide.ts in the app. */
export type ReviewOps = {
  decide(input: NewTrialInput): Promise<{ status: ReviewStatus; signals: Record<string, unknown> }>;
};

export type ProvisionDeps = {
  stripe: StripeOps;
  store: BillingStore;
  keys: KeyOps;
  review: ReviewOps;
  /** Tags for new keys (plan §10.4: platform=v2, env=…). */
  keyTags: Record<string, string>;
  now?: () => Date;
};

/** What we know about a checkout, from the session or the subscription's metadata. */
export type CheckoutContext = { userId: string };

export type Effect =
  | {
      type: "admin_new_customer";
      orgName: string;
      email: string;
      stripePriceId: string;
      trialing: boolean;
    }
  | { type: "brevo_add"; email: string }
  | { type: "brevo_trial_converted"; email: string }
  | { type: "brevo_remove"; email: string }
  | { type: "new_key_notice"; orgId: string; orgName: string }
  /** A new trial is waiting for review: tell the owner and the admins (plan §6.11). */
  | { type: "review_pending"; orgId: string; orgName: string; email: string };

export type SyncResult =
  | { status: "skipped"; reason: "eiscd" | "no_organisation" }
  | {
      status: "synced";
      orgId: string;
      created: boolean;
      keyActions: KeyAction[];
      effects: Effect[];
    };

export async function syncSubscription(
  deps: ProvisionDeps,
  stripeSubscriptionId: string,
  checkout: CheckoutContext | null,
): Promise<SyncResult> {
  const lock = `subscription:${stripeSubscriptionId}`;
  if (!(await deps.store.tryLock(lock))) throw new ProvisioningBusyError(stripeSubscriptionId);
  try {
    return await sync(deps, stripeSubscriptionId, checkout);
  } finally {
    await deps.store.releaseLock(lock);
  }
}

async function sync(
  deps: ProvisionDeps,
  stripeSubscriptionId: string,
  checkout: CheckoutContext | null,
): Promise<SyncResult> {
  const { stripe, store } = deps;
  const now = deps.now ?? (() => new Date());

  const sub = await stripe.retrieveSubscription(stripeSubscriptionId);
  const record = deriveSubscriptionRecord(sub);

  // EISCD is provisioned by admins (plan §6.7, phase 5); nothing to do here.
  if (record.product === "eiscd") return { status: "skipped", reason: "eiscd" };
  if (record.missingPlanMetadata && !record.expired) {
    throw new MissingPlanMetadataError(record.stripePriceId);
  }

  // The organisation: found by Stripe customer, or created for the buyer.
  const buyer = checkout ?? userFromMetadata(sub);
  let org = await store.findOrgByCustomer(record.stripeCustomerId);
  let created = false;
  if (!org) {
    if (!buyer || !isLiveStatus(record.status)) {
      // Nobody to make the owner, or nothing live to provision. A
      // subscription made outside checkout belongs to an existing
      // organisation, or to admin set-up (ADM-12, phase 5).
      return { status: "skipped", reason: "no_organisation" };
    }
    org = await createOrganisation(deps, sub, record, buyer.userId);
    created = true;
  }

  const previous = await store.getSubscription(record.stripeSubscriptionId);

  // PROV-01: a completed checkout replaces whatever the customer had. The
  // checkout guard (BUY-05) means this only happens for deliberate
  // replacements such as accepting an offer.
  if (checkout && isLiveStatus(record.status)) {
    const others = (await stripe.listLiveSubscriptionIds(record.stripeCustomerId)).filter(
      (id) => id !== record.stripeSubscriptionId,
    );
    for (const id of others) await stripe.cancelSubscription(id, UPGRADE_CANCELLATION_COMMENT);
  }

  // The key: the one this subscription already uses, else the one made for
  // its item on an earlier attempt. The key follows the subscription, so a
  // price change never swaps it (PLAN-01).
  const key = await currentKey(store, previous, record);
  const keyActions = planKeyActions({ record, reviewStatus: org.reviewStatus, key });
  const keyState = await applyKeyActions(deps, keyActions, key, record);

  let keyNoticeAt: Date | null = null;
  const createdKey = keyActions.some((action) => action.type === "create");
  if (createdKey && keyState && (await store.hasOtherKeys(org.id, keyState.id))) {
    // BILL-08: a returning customer has a new key; the old one stays off.
    keyNoticeAt = now();
  }

  if (keyState) {
    await store.saveKey({
      id: keyState.id,
      orgId: org.id,
      product: record.product,
      stripeSubscriptionItemId: record.stripeSubscriptionItemId,
      enabled: keyState.enabled,
      usagePlanId: keyState.usagePlanId,
    });
  }
  await store.saveSubscription({
    orgId: org.id,
    record,
    apiKeyId: keyState?.id ?? previous?.apiKeyId ?? null,
    keyNoticeAt,
  });

  // A scheduled downgrade has taken effect (PLAN-04).
  if (isLiveStatus(record.status)) {
    await store.completeScheduledChange(org.id, record.stripePriceId);
  }

  const effects = await planEffects(store, {
    org,
    record,
    previous,
    keyNotice: Boolean(keyNoticeAt),
  });
  return { status: "synced", orgId: org.id, created, keyActions, effects };
}

function userFromMetadata(sub: SubscriptionLike): CheckoutContext | null {
  // startCheckout puts the buyer's user ID on the subscription too, so
  // customer.subscription.created can provision even if it arrives first.
  const userId = sub.metadata?.user_id?.trim();
  return userId ? { userId } : null;
}

async function createOrganisation(
  { store, review }: ProvisionDeps,
  sub: SubscriptionLike,
  record: SubscriptionRecord,
  ownerId: string,
): Promise<OrgSummary> {
  const profile = await store.getProfile(ownerId);
  if (!profile) throw new Error(`No profile for the buyer ${ownerId}`);
  const name = profile.companyName?.trim() || profile.email.split("@")[1] || "My organisation";

  // A new trial organisation is held for review unless a rule approves it
  // (APPR-01, APPR-02). The decision and the signals behind it are kept on
  // the organisation for the review queue (APPR-04).
  const meta = priceMeta(subscriptionItem(sub)?.price);
  const { status, signals } = await review.decide({
    ownerEmail: profile.email,
    companyName: profile.companyName,
    phone: profile.phone,
    stripePriceId: record.stripePriceId,
    tier: meta.tier,
    interval: meta.interval,
    trialing: record.trialing,
    metadata: { ...sub.metadata },
  });
  return store.provisionOrganisation({
    name,
    stripeCustomerId: record.stripeCustomerId,
    ownerId,
    reviewStatus: status,
    signupSignals: signals,
  });
}

async function currentKey(
  store: BillingStore,
  previous: StoredSubscription | null,
  record: SubscriptionRecord,
): Promise<KeyState | null> {
  if (previous?.apiKeyId) {
    const key = await store.getKey(previous.apiKeyId);
    if (key) return key;
  }
  return record.stripeSubscriptionItemId
    ? store.getKeyForItem(record.stripeSubscriptionItemId)
    : null;
}

async function applyKeyActions(
  { keys, keyTags }: ProvisionDeps,
  actions: KeyAction[],
  key: KeyState | null,
  record: SubscriptionRecord,
): Promise<KeyState | null> {
  let state = key;
  for (const action of actions) {
    switch (action.type) {
      case "create": {
        // Find a key left by an attempt that failed before the database
        // write, so a retry never mints a second key (NFR-04).
        const name = keys.keyNameFor(
          record.stripeSubscriptionItemId ?? record.stripeSubscriptionId,
        );
        const existing = await keys.findKeyByName(name);
        if (existing) {
          await keys.enableKey(existing.id, action.usagePlanId);
          state = { id: existing.id, enabled: true, usagePlanId: action.usagePlanId };
        } else {
          const createdKey = await keys.createKey({
            name,
            usagePlanId: action.usagePlanId,
            tags: keyTags,
          });
          state = { id: createdKey.id, enabled: true, usagePlanId: action.usagePlanId };
        }
        break;
      }
      case "enable":
        await keys.enableKey(action.keyId, action.usagePlanId);
        state = { id: action.keyId, enabled: true, usagePlanId: action.usagePlanId };
        break;
      case "move":
        await keys.moveKey(action.keyId, action.from, action.to);
        state = { id: action.keyId, enabled: state?.enabled ?? true, usagePlanId: action.to };
        break;
      case "disable":
        await keys.disableKey(action.keyId, action.usagePlanId);
        state = { id: action.keyId, enabled: false, usagePlanId: null };
        break;
    }
  }
  return state;
}

async function planEffects(
  store: BillingStore,
  input: {
    org: OrgSummary;
    record: SubscriptionRecord;
    previous: StoredSubscription | null;
    keyNotice: boolean;
  },
): Promise<Effect[]> {
  const { org, record, previous } = input;
  const effects: Effect[] = [];
  const owner = await store.getOwner(org.id);
  const isNewSubscription = !previous && isLiveStatus(record.status);

  if (isNewSubscription && owner && org.reviewStatus === "pending_review") {
    // plan §6.11: the owner is told we're reviewing, and admins are asked
    // to review. The marketing list waits for approval.
    effects.push({ type: "review_pending", orgId: org.id, orgName: org.name, email: owner.email });
  } else if (isNewSubscription && owner) {
    // PROV-02: tell Mintly, and add the customer to the marketing list
    // unless they opted out (AUTH-06).
    effects.push({
      type: "admin_new_customer",
      orgName: org.name,
      email: owner.email,
      stripePriceId: record.stripePriceId,
      trialing: record.trialing,
    });
    if (!owner.marketingOptOut) effects.push({ type: "brevo_add", email: owner.email });
  }

  if (owner && previous) {
    // PROV-04: the trial has converted to paid.
    if (previous.trialing && !record.trialing && isLiveStatus(record.status)) {
      effects.push({ type: "brevo_trial_converted", email: owner.email });
    }
    // PROV-06 and PROV-07: the customer asked to cancel, or the
    // subscription ended (not by being replaced).
    const askedToCancel = !previous.cancelAt && record.cancelAt && !record.expired;
    const ended = !previous.expired && record.expired && !record.replacedByUpgrade;
    if (askedToCancel || ended) effects.push({ type: "brevo_remove", email: owner.email });
  }

  if (input.keyNotice) {
    effects.push({ type: "new_key_notice", orgId: org.id, orgName: org.name });
  }

  return effects;
}
