// An in-memory BillingStore for unit tests of provisioning and the webhook.

import type { ReviewStatus } from "@/lib/nav";

import type { KeyState } from "./key-plan";
import type { BillingStore, EventClaim, OrgSummary, Person, StoredSubscription } from "./store";
import type { Product, SubscriptionRecord } from "./subscription-record";

type Org = OrgSummary & { stripeCustomerId: string; signupSignals: Record<string, unknown> };
type Key = KeyState & { orgId: string; product: Product; stripeSubscriptionItemId: string | null };
type Sub = {
  orgId: string;
  record: SubscriptionRecord;
  apiKeyId: string | null;
  keyNoticeAt: Date | null;
};
type User = Person & { companyName: string | null; phone: string | null };

export class MemoryBillingStore implements BillingStore {
  events = new Map<string, { type: string; processed: boolean; error: string | null }>();
  locks = new Set<string>();
  orgs = new Map<string, Org>();
  members = new Map<string, { orgId: string; role: "owner" | "developer" | "member" }>();
  users = new Map<string, User>();
  keys = new Map<string, Key>();
  subscriptions = new Map<string, Sub>();
  private nextOrg = 0;

  addUser(id: string, user: Partial<User> & { email: string }) {
    this.users.set(id, { marketingOptOut: false, companyName: null, phone: null, ...user });
  }

  async claimEvent(id: string, type: string): Promise<EventClaim> {
    const existing = this.events.get(id);
    if (existing) return existing.processed ? "processed" : "retry";
    this.events.set(id, { type, processed: false, error: null });
    return "new";
  }
  async markEventProcessed(id: string) {
    const event = this.events.get(id);
    if (event) Object.assign(event, { processed: true, error: null });
  }
  async markEventFailed(id: string, error: string) {
    const event = this.events.get(id);
    if (event) event.error = error;
  }

  async tryLock(key: string) {
    if (this.locks.has(key)) return false;
    this.locks.add(key);
    return true;
  }
  async releaseLock(key: string) {
    this.locks.delete(key);
  }

  async findOrgByCustomer(stripeCustomerId: string) {
    const org = [...this.orgs.values()].find((o) => o.stripeCustomerId === stripeCustomerId);
    return org ? { id: org.id, name: org.name, reviewStatus: org.reviewStatus } : null;
  }
  async provisionOrganisation(input: {
    name: string;
    stripeCustomerId: string;
    ownerId: string;
    reviewStatus: ReviewStatus;
    signupSignals: Record<string, unknown>;
  }) {
    const existing = await this.findOrgByCustomer(input.stripeCustomerId);
    if (existing) return existing;
    if (this.members.has(input.ownerId)) throw new Error("duplicate key value (memberships)");
    const id = `org_${++this.nextOrg}`;
    this.orgs.set(id, {
      id,
      name: input.name,
      reviewStatus: input.reviewStatus,
      stripeCustomerId: input.stripeCustomerId,
      signupSignals: input.signupSignals,
    });
    this.members.set(input.ownerId, { orgId: id, role: "owner" });
    return { id, name: input.name, reviewStatus: input.reviewStatus };
  }

  async getSubscription(id: string): Promise<StoredSubscription | null> {
    const sub = this.subscriptions.get(id);
    if (!sub) return null;
    return {
      apiKeyId: sub.apiKeyId,
      trialing: sub.record.trialing,
      expired: sub.record.expired,
      cancelAt: sub.record.cancelAt,
    };
  }
  async getKey(id: string) {
    const key = this.keys.get(id);
    return key ? { id: key.id, enabled: key.enabled, usagePlanId: key.usagePlanId } : null;
  }
  async getKeyForItem(itemId: string) {
    const key = [...this.keys.values()].find((k) => k.stripeSubscriptionItemId === itemId);
    return key ? { id: key.id, enabled: key.enabled, usagePlanId: key.usagePlanId } : null;
  }
  async hasOtherKeys(orgId: string, keyId: string) {
    return [...this.keys.values()].some((k) => k.orgId === orgId && k.id !== keyId);
  }
  async saveKey(input: Key) {
    this.keys.set(input.id, { ...input });
  }
  async saveSubscription(input: Sub) {
    const existing = this.subscriptions.get(input.record.stripeSubscriptionId);
    this.subscriptions.set(input.record.stripeSubscriptionId, {
      ...input,
      keyNoticeAt: input.keyNoticeAt ?? existing?.keyNoticeAt ?? null,
    });
  }

  async getProfile(userId: string) {
    return this.users.get(userId) ?? null;
  }
  async getOwner(orgId: string) {
    for (const [userId, m] of this.members) {
      if (m.orgId === orgId && m.role === "owner") return this.users.get(userId) ?? null;
    }
    return null;
  }
  async getKeyHolders(orgId: string) {
    return [...this.members]
      .filter(([, m]) => m.orgId === orgId && m.role !== "member")
      .flatMap(([userId]) => this.users.get(userId) ?? []);
  }
}
