// The AWS adapter's contract (plan §7). Everything outside src/lib/aws uses
// these functions, never the AWS SDK, so a move off AWS (Q9) changes only
// this folder.

export type ApiKeyInfo = { id: string; name: string; enabled: boolean };

export interface ApiKeyStore {
  /** A key by its exact name, used to make creation idempotent. */
  findKeyByName(name: string): Promise<ApiKeyInfo | null>;
  /** Creates an enabled key and attaches it to the usage plan. */
  createKey(input: {
    name: string;
    usagePlanId: string;
    tags: Record<string, string>;
  }): Promise<ApiKeyInfo>;
  /** The key's secret value, or null if there is no such key. */
  getKeyValue(keyId: string): Promise<string | null>;
  setEnabled(keyId: string, enabled: boolean): Promise<void>;
  /** Adds the key to a usage plan; already being in it is fine. */
  addToPlan(keyId: string, usagePlanId: string): Promise<void>;
  /** Removes the key from a usage plan; not being in it is fine. */
  removeFromPlan(keyId: string, usagePlanId: string): Promise<void>;
  /** The usage plans the key is in. */
  getKeyPlans(keyId: string): Promise<string[]>;
}

export type UsagePlanInfo = {
  id: string;
  name: string;
  description: string | null;
  quota: { limit: number; period: string } | null;
  throttle: { rateLimit: number | null; burstLimit: number | null } | null;
};

export interface UsagePlanStore {
  listUsagePlans(): Promise<UsagePlanInfo[]>;
  getUsagePlan(id: string): Promise<UsagePlanInfo | null>;
}
