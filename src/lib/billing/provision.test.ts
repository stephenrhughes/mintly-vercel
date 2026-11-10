import { beforeEach, describe, expect, it } from "vitest";

import { createFakeApiKeyStore, newFakeState } from "@/lib/aws/fake";
import type { ReviewStatus } from "@/lib/nav";

import { PAID_PLAN, price, subscription, TRIAL_PLAN } from "./fixtures";
import {
  MissingPlanMetadataError,
  type KeyOps,
  type NewTrialInput,
  type ProvisionDeps,
  ProvisioningBusyError,
  type StripeOps,
  syncSubscription,
} from "./provision";
import { MemoryBillingStore } from "./store-memory";
import { type SubscriptionLike, UPGRADE_CANCELLATION_COMMENT } from "./subscription-record";
import { eventTarget, handleStripeEvent } from "./webhook";

// A fake Stripe holding subscriptions by ID, and a key store over the AWS fake.
function setup() {
  const subs = new Map<string, SubscriptionLike>();
  const cancelled: Array<{ id: string; comment: string }> = [];
  const stripe: StripeOps = {
    async retrieveSubscription(id) {
      const sub = subs.get(id);
      if (!sub) throw new Error(`no subscription ${id}`);
      return structuredClone(sub);
    },
    async listLiveSubscriptionIds(customer) {
      return [...subs.values()]
        .filter(
          (s) => s.customer === customer && ["trialing", "active", "past_due"].includes(s.status),
        )
        .map((s) => s.id);
    },
    async cancelSubscription(id, comment) {
      cancelled.push({ id, comment });
      const sub = subs.get(id);
      if (sub) Object.assign(sub, { status: "canceled", cancellation_details: { comment } });
    },
  };

  const aws = newFakeState();
  const awsStore = createFakeApiKeyStore(aws);
  let creates = 0;
  const keys: KeyOps = {
    findKeyByName: (name) => awsStore.findKeyByName(name),
    async createKey(input) {
      creates++;
      return awsStore.createKey(input);
    },
    async enableKey(id, plan) {
      await awsStore.addToPlan(id, plan);
      await awsStore.setEnabled(id, true);
    },
    async disableKey(id, plan) {
      await awsStore.setEnabled(id, false);
      if (plan) await awsStore.removeFromPlan(id, plan);
    },
    async moveKey(id, from, to) {
      await awsStore.addToPlan(id, to);
      if (from && from !== to) await awsStore.removeFromPlan(id, from);
    },
    keyNameFor: (item) => `v2-${item}`,
  };

  const store = new MemoryBillingStore();
  store.addUser("user_olivia", { email: "olivia@acme.test", companyName: "Acme Ltd" });
  // Most tests approve straight away; the trial review tests hold for review.
  const review = {
    status: "approved" as ReviewStatus,
    inputs: [] as NewTrialInput[],
    async decide(input: NewTrialInput) {
      review.inputs.push(input);
      return { status: review.status, signals: { decided: review.status } };
    },
  };
  const deps: ProvisionDeps = {
    stripe,
    store,
    keys,
    review,
    keyTags: { platform: "v2", env: "test" },
    now: () => new Date("2026-11-10T12:00:00Z"),
  };
  return { deps, store, subs, aws, cancelled, review, creates: () => creates };
}

const trial = (overrides: Parameters<typeof subscription>[0] = {}) =>
  subscription({ status: "trialing", trial_end: 1_800_000_000, ...overrides });

const checkoutEvent = (id = "evt_checkout", sub = "sub_1", user = "user_olivia") => ({
  id,
  type: "checkout.session.completed",
  data: { object: { mode: "subscription", subscription: sub, client_reference_id: user } },
});

const subscriptionEvent = (id: string, type = "customer.subscription.updated", sub = "sub_1") => ({
  id,
  type,
  data: { object: { id: sub } },
});

let t: ReturnType<typeof setup>;
beforeEach(() => {
  t = setup();
});

describe("checkout (PROV-01)", () => {
  it("creates the organisation, makes the buyer owner, and creates a key in the trial plan", async () => {
    t.subs.set("sub_1", trial());
    const outcome = await handleStripeEvent(t.deps, checkoutEvent());

    expect(outcome.status).toBe("handled");
    const [org] = [...t.store.orgs.values()];
    expect(org).toMatchObject({
      name: "Acme Ltd",
      stripeCustomerId: "cus_1",
      reviewStatus: "approved",
    });
    expect(t.store.members.get("user_olivia")).toEqual({ orgId: org.id, role: "owner" });

    const [key] = [...t.store.keys.values()];
    expect(key).toMatchObject({
      enabled: true,
      usagePlanId: TRIAL_PLAN,
      stripeSubscriptionItemId: "si_1",
    });
    expect(t.aws.keys.get(key.id)?.plans).toEqual(new Set([TRIAL_PLAN]));
    expect(t.aws.keys.get(key.id)?.tags).toEqual({ platform: "v2", env: "test" });

    const row = t.store.subscriptions.get("sub_1");
    expect(row).toMatchObject({ orgId: org.id, apiKeyId: key.id, keyNoticeAt: null });
    expect(row?.record).toMatchObject({ trialing: true, maxTeamSize: 1 });
  });

  it("tells Mintly and adds the owner to Brevo (PROV-02)", async () => {
    t.subs.set("sub_1", trial());
    const outcome = await handleStripeEvent(t.deps, checkoutEvent());
    expect(outcome.status === "handled" && outcome.effects).toEqual([
      {
        type: "admin_new_customer",
        orgName: "Acme Ltd",
        email: "olivia@acme.test",
        stripePriceId: "price_monthly",
        trialing: true,
      },
      { type: "brevo_add", email: "olivia@acme.test" },
    ]);
  });

  it("leaves an owner who opted out off the marketing list (AUTH-06)", async () => {
    t.store.addUser("user_olivia", { email: "olivia@acme.test", marketingOptOut: true });
    t.subs.set("sub_1", trial());
    const outcome = await handleStripeEvent(t.deps, checkoutEvent());
    expect(outcome.status === "handled" && outcome.effects.map((e) => e.type)).toEqual([
      "admin_new_customer",
    ]);
  });

  it("cancels the customer's other subscriptions as replaced (PROV-01)", async () => {
    t.subs.set("sub_old", subscription({ id: "sub_old" }));
    t.subs.set("sub_1", trial());
    await handleStripeEvent(t.deps, checkoutEvent());
    expect(t.cancelled).toEqual([{ id: "sub_old", comment: UPGRADE_CANCELLATION_COMMENT }]);
  });

  it("provisions from customer.subscription.created when it arrives first", async () => {
    t.subs.set("sub_1", trial({ metadata: { user_id: "user_olivia" } }));
    await handleStripeEvent(
      t.deps,
      subscriptionEvent("evt_created", "customer.subscription.created"),
    );
    await handleStripeEvent(t.deps, checkoutEvent());
    expect(t.store.orgs.size).toBe(1);
    expect(t.store.keys.size).toBe(1);
    expect(t.creates()).toBe(1);
  });

  it("skips a subscription with no organisation and no buyer", async () => {
    t.subs.set("sub_1", trial());
    const outcome = await handleStripeEvent(t.deps, subscriptionEvent("evt_x"));
    expect(outcome.status === "handled" && outcome.result).toEqual({
      status: "skipped",
      reason: "no_organisation",
    });
    expect(t.store.orgs.size).toBe(0);
  });
});

describe("trial review (plan §6.11)", () => {
  it("holds a new trial for review: no key, and the owner and admins are told (APPR-01)", async () => {
    t.review.status = "pending_review";
    t.subs.set(
      "sub_1",
      trial({ metadata: { user_id: "user_olivia", signup_ip_hash: "abc", signup_country: "GB" } }),
    );
    const outcome = await handleStripeEvent(t.deps, checkoutEvent());

    const [org] = [...t.store.orgs.values()];
    expect(org).toMatchObject({
      reviewStatus: "pending_review",
      signupSignals: { decided: "pending_review" },
    });
    expect(t.store.keys.size).toBe(0);
    expect(t.creates()).toBe(0);
    expect(t.store.subscriptions.get("sub_1")).toMatchObject({ apiKeyId: null });
    // The marketing list and the new-customer notice wait for approval.
    expect(outcome.status === "handled" && outcome.effects).toEqual([
      { type: "review_pending", orgId: org.id, orgName: "Acme Ltd", email: "olivia@acme.test" },
    ]);
  });

  it("gives the reviewer what the checkout knew (APPR-04)", async () => {
    t.store.addUser("user_olivia", {
      email: "olivia@acme.test",
      companyName: "Acme Ltd",
      phone: "+44 20 7946 0000",
    });
    t.subs.set("sub_1", trial({ metadata: { user_id: "user_olivia", signup_country: "GB" } }));
    await handleStripeEvent(t.deps, checkoutEvent());
    expect(t.review.inputs).toEqual([
      {
        ownerEmail: "olivia@acme.test",
        companyName: "Acme Ltd",
        phone: "+44 20 7946 0000",
        stripePriceId: "price_monthly",
        tier: "starter",
        interval: "monthly",
        trialing: true,
        metadata: { user_id: "user_olivia", signup_country: "GB" },
      },
    ]);
  });

  it("creates the key once an admin has approved and the subscription syncs again", async () => {
    t.review.status = "pending_review";
    t.subs.set("sub_1", trial());
    await handleStripeEvent(t.deps, checkoutEvent());
    const [org] = [...t.store.orgs.values()];

    org.reviewStatus = "approved";
    await syncSubscription(t.deps, "sub_1", null);
    expect([...t.store.keys.values()]).toMatchObject([{ enabled: true, usagePlanId: TRIAL_PLAN }]);
    expect(t.store.subscriptions.get("sub_1")?.apiKeyId).toBe([...t.store.keys.keys()][0]);
  });

  it("asks for no decision when the organisation already exists", async () => {
    t.subs.set("sub_1", trial());
    await handleStripeEvent(t.deps, checkoutEvent());
    await handleStripeEvent(t.deps, subscriptionEvent("evt_again"));
    expect(t.review.inputs).toHaveLength(1);
  });
});

describe("idempotency (NFR-04)", () => {
  it("skips an event it has already processed", async () => {
    t.subs.set("sub_1", trial());
    await handleStripeEvent(t.deps, checkoutEvent());
    expect(await handleStripeEvent(t.deps, checkoutEvent())).toEqual({ status: "duplicate" });
    expect(t.creates()).toBe(1);
  });

  it("never mints a second key when the same checkout is redelivered under a new event ID", async () => {
    t.subs.set("sub_1", trial());
    await handleStripeEvent(t.deps, checkoutEvent("evt_a"));
    await handleStripeEvent(t.deps, checkoutEvent("evt_b"));
    expect(t.creates()).toBe(1);
    expect(t.store.keys.size).toBe(1);
  });

  it("reuses a key left by an attempt that failed before the database write", async () => {
    t.subs.set("sub_1", trial());
    const saveKey = t.store.saveKey.bind(t.store);
    t.store.saveKey = async () => {
      throw new Error("database down");
    };
    await expect(handleStripeEvent(t.deps, checkoutEvent())).rejects.toThrow("database down");
    expect(t.store.events.get("evt_checkout")).toMatchObject({
      processed: false,
      error: "database down",
    });

    t.store.saveKey = saveKey;
    await handleStripeEvent(t.deps, checkoutEvent());
    expect(t.creates()).toBe(1);
    expect(t.store.keys.size).toBe(1);
    expect(t.store.events.get("evt_checkout")).toMatchObject({ processed: true, error: null });
  });

  it("refuses to run while another event holds the subscription's lock", async () => {
    t.subs.set("sub_1", trial());
    await t.store.tryLock("subscription:sub_1");
    await expect(
      syncSubscription(t.deps, "sub_1", { userId: "user_olivia" }),
    ).rejects.toBeInstanceOf(ProvisioningBusyError);
  });

  it("releases the lock when provisioning fails", async () => {
    t.subs.set("sub_1", trial({ price: price({ metadata: {} }) }));
    await expect(
      syncSubscription(t.deps, "sub_1", { userId: "user_olivia" }),
    ).rejects.toBeInstanceOf(MissingPlanMetadataError);
    expect(t.store.locks.size).toBe(0);
  });
});

describe("lifecycle", () => {
  beforeEach(async () => {
    t.subs.set("sub_1", trial());
    await handleStripeEvent(t.deps, checkoutEvent());
  });
  const key = () => [...t.store.keys.values()][0];

  it("moves the key to the paid plan when the trial converts, keeping the same key (PROV-04)", async () => {
    const before = key().id;
    t.subs.set("sub_1", subscription());
    const outcome = await handleStripeEvent(t.deps, subscriptionEvent("evt_paid"));
    expect(key()).toMatchObject({ id: before, usagePlanId: PAID_PLAN });
    expect(t.aws.keys.get(before)?.plans).toEqual(new Set([PAID_PLAN]));
    expect(outcome.status === "handled" && outcome.effects).toEqual([
      { type: "brevo_trial_converted", email: "olivia@acme.test" },
    ]);
  });

  it("moves the key when the price changes to another usage plan (PROV-05)", async () => {
    t.subs.set(
      "sub_1",
      subscription({
        price: price({ id: "price_pro", metadata: { usagePlanId: "plan_pro", maxTeamSize: "15" } }),
      }),
    );
    await handleStripeEvent(t.deps, subscriptionEvent("evt_price"));
    expect(key().usagePlanId).toBe("plan_pro");
    expect(t.store.subscriptions.get("sub_1")?.record).toMatchObject({
      stripePriceId: "price_pro",
      maxTeamSize: 15,
    });
  });

  it("completes a scheduled downgrade when Stripe moves to its price (PLAN-04)", async () => {
    const [org] = [...t.store.orgs.values()];
    t.store.scheduledChanges.set(org.id, { toPriceId: "price_starter", status: "scheduled" });
    t.subs.set("sub_1", subscription({ price: price({ id: "price_other" }) }));
    await handleStripeEvent(t.deps, subscriptionEvent("evt_other"));
    expect(t.store.scheduledChanges.get(org.id)?.status).toBe("scheduled");
    t.subs.set("sub_1", subscription({ price: price({ id: "price_starter" }) }));
    await handleStripeEvent(t.deps, subscriptionEvent("evt_starter"));
    expect(t.store.scheduledChanges.get(org.id)?.status).toBe("done");
  });

  it("records a requested cancellation and removes the owner from Brevo (PROV-06)", async () => {
    t.subs.set("sub_1", trial({ cancel_at_period_end: true, cancel_at: 1_800_000_000 }));
    const outcome = await handleStripeEvent(t.deps, subscriptionEvent("evt_cancel"));
    expect(t.store.subscriptions.get("sub_1")?.record.cancelAt).toEqual(
      new Date(1_800_000_000_000),
    );
    expect(key().enabled).toBe(true);
    expect(outcome.status === "handled" && outcome.effects).toEqual([
      { type: "brevo_remove", email: "olivia@acme.test" },
    ]);
  });

  it("disables the key when the subscription ends (PROV-07)", async () => {
    t.subs.set("sub_1", trial({ status: "canceled", ended_at: 1_800_000_000 }));
    await handleStripeEvent(t.deps, subscriptionEvent("evt_end", "customer.subscription.deleted"));
    expect(key()).toMatchObject({ enabled: false, usagePlanId: null });
    expect(t.aws.keys.get(key().id)).toMatchObject({ enabled: false });
    expect(t.store.subscriptions.get("sub_1")?.record.expired).toBe(true);
  });

  it("leaves the key alone when the subscription was replaced by an upgrade (PROV-07)", async () => {
    t.subs.set(
      "sub_1",
      trial({
        status: "canceled",
        cancellation_details: { comment: UPGRADE_CANCELLATION_COMMENT },
      }),
    );
    await handleStripeEvent(
      t.deps,
      subscriptionEvent("evt_replaced", "customer.subscription.deleted"),
    );
    expect(key().enabled).toBe(true);
  });

  it("gives a returning customer a new key and flags the notice (BILL-08)", async () => {
    const oldKey = key().id;
    t.subs.set("sub_1", trial({ status: "canceled", ended_at: 1_800_000_000 }));
    await handleStripeEvent(t.deps, subscriptionEvent("evt_end", "customer.subscription.deleted"));

    t.subs.set(
      "sub_2",
      subscription({
        id: "sub_2",
        items: { data: [{ id: "si_2", object: "subscription_item", price: price() }] },
      }),
    );
    const outcome = await handleStripeEvent(t.deps, checkoutEvent("evt_back", "sub_2"));

    const row = t.store.subscriptions.get("sub_2");
    expect(row?.apiKeyId).not.toBe(oldKey);
    expect(row?.keyNoticeAt).toEqual(new Date("2026-11-10T12:00:00Z"));
    expect(t.store.keys.get(oldKey)?.enabled).toBe(false);
    expect(outcome.status === "handled" && outcome.effects.map((e) => e.type)).toContain(
      "new_key_notice",
    );
    expect(t.store.orgs.size).toBe(1);
  });

  it("refreshes the period end when an invoice is paid (PROV-08)", async () => {
    const renewed = subscription();
    renewed.items.data[0].current_period_end = 1_900_000_000;
    t.subs.set("sub_1", renewed);
    await handleStripeEvent(t.deps, {
      id: "evt_invoice",
      type: "invoice.paid",
      data: { object: { parent: { subscription_details: { subscription: "sub_1" } } } },
    });
    expect(t.store.subscriptions.get("sub_1")?.record.currentPeriodEnd).toEqual(
      new Date(1_900_000_000_000),
    );
  });

  it("still records an ended subscription whose price has lost its metadata", async () => {
    t.subs.set("sub_1", trial({ status: "canceled", ended_at: 5, price: price({ metadata: {} }) }));
    await handleStripeEvent(t.deps, subscriptionEvent("evt_end", "customer.subscription.deleted"));
    expect(key().enabled).toBe(false);
  });
});

describe("refusals", () => {
  it("returns an error for a price without usage plan metadata, so Stripe retries (PROV-10)", async () => {
    t.subs.set("sub_1", trial({ price: price({ id: "price_bad", metadata: {} }) }));
    await expect(handleStripeEvent(t.deps, checkoutEvent())).rejects.toThrow(/price_bad/);
    expect(t.store.events.get("evt_checkout")?.processed).toBe(false);
  });

  it("provisions an EISCD subscription for an organisation an admin set up (plan §6.7)", async () => {
    t.subs.set("sub_1", trial());
    await handleStripeEvent(t.deps, checkoutEvent());
    const eiscd = price({
      id: "price_eiscd",
      metadata: { product: "eiscd", usagePlanId: "plan_eiscd" },
    });
    t.subs.set(
      "sub_e",
      subscription({
        id: "sub_e",
        items: {
          data: [
            {
              id: "si_e",
              object: "subscription_item",
              current_period_end: 1_800_000_000,
              price: eiscd,
            },
          ],
        },
      }),
    );
    const outcome = await handleStripeEvent(
      t.deps,
      subscriptionEvent("evt_e", "customer.subscription.created", "sub_e"),
    );
    expect(outcome.status === "handled" && outcome.result.status).toBe("synced");
    const key = [...t.store.keys.values()].find((k) => k.product === "eiscd");
    expect(key).toMatchObject({
      enabled: true,
      usagePlanId: "plan_eiscd",
      stripeSubscriptionItemId: "si_e",
    });
  });

  it("ignores EISCD subscriptions for customers with no organisation (plan §6.7)", async () => {
    t.subs.set("sub_1", trial({ price: price({ metadata: { product: "eiscd" } }) }));
    const outcome = await handleStripeEvent(t.deps, checkoutEvent());
    expect(outcome.status === "handled" && outcome.result).toEqual({
      status: "skipped",
      reason: "eiscd",
    });
    expect(t.store.orgs.size).toBe(0);
  });
});

describe("eventTarget", () => {
  it("finds the subscription for each handled event type", () => {
    expect(eventTarget(checkoutEvent())).toEqual({
      subscriptionId: "sub_1",
      checkoutUserId: "user_olivia",
    });
    expect(eventTarget(subscriptionEvent("e", "customer.subscription.deleted", "sub_9"))).toEqual({
      subscriptionId: "sub_9",
      checkoutUserId: null,
    });
    expect(
      eventTarget({
        id: "e",
        type: "invoice.payment_failed",
        data: { object: { parent: { subscription_details: { subscription: { id: "sub_3" } } } } },
      }),
    ).toEqual({ subscriptionId: "sub_3", checkoutUserId: null });
  });

  it("ignores payment-mode checkouts, invoices without a subscription and other events", () => {
    expect(
      eventTarget({
        id: "e",
        type: "checkout.session.completed",
        data: { object: { mode: "setup" } },
      }),
    ).toBeNull();
    expect(
      eventTarget({ id: "e", type: "invoice.paid", data: { object: { parent: null } } }),
    ).toBeNull();
    expect(eventTarget({ id: "e", type: "customer.created", data: { object: {} } })).toBeNull();
  });
});
