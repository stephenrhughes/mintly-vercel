// An in-memory stand-in for API Gateway, used when AWS_ROLE_ARN is unset
// (local development, CI and previews before the staging role exists). It
// refuses to run in production. State lives on globalThis so it survives
// hot reloads in `next dev`; it is lost when the server restarts.

import { randomUUID } from "node:crypto";

import { getDeploymentEnvironment } from "@/lib/site";

import type {
  ApiKeyInfo,
  ApiKeyStore,
  DailyStat,
  UsagePlanInfo,
  UsagePlanStore,
  UsageStatsStore,
} from "./types";

type FakeKey = ApiKeyInfo & { value: string; plans: Set<string>; tags: Record<string, string> };

type FakeState = { keys: Map<string, FakeKey>; counter: number };

const globalState = globalThis as typeof globalThis & { __mintlyFakeAws?: FakeState };

function state(): FakeState {
  globalState.__mintlyFakeAws ??= { keys: new Map(), counter: 0 };
  return globalState.__mintlyFakeAws;
}

function assertNotProduction(env: Record<string, string | undefined> = process.env) {
  if (getDeploymentEnvironment(env) === "production") {
    throw new Error("The fake AWS adapter can't run in production: set AWS_ROLE_ARN.");
  }
}

function log(message: string) {
  console.info(`[fake-aws] ${message}`);
}

/** A fresh in-memory store. Tests pass their own state; the app shares one. */
export function createFakeApiKeyStore(own?: FakeState): ApiKeyStore {
  const s = () => own ?? state();
  const get = (id: string) => {
    const key = s().keys.get(id);
    if (!key) throw new Error(`[fake-aws] no key ${id}`);
    return key;
  };
  const info = ({ id, name, enabled }: FakeKey): ApiKeyInfo => ({ id, name, enabled });

  return {
    async findKeyByName(name) {
      assertNotProduction();
      const key = [...s().keys.values()].find((k) => k.name === name);
      return key ? info(key) : null;
    },
    async createKey({ name, usagePlanId, tags }) {
      assertNotProduction();
      const n = ++s().counter;
      const key: FakeKey = {
        // Random, not numbered: the database outlives this in-memory state
        // (a restarted dev server), and a reused ID would point at another
        // organisation's key row.
        id: `fakekey${randomUUID().replaceAll("-", "").slice(0, 10)}`,
        name,
        enabled: true,
        value: `fake_${n}_${Math.random().toString(36).slice(2, 14)}`,
        plans: new Set([usagePlanId]),
        tags,
      };
      s().keys.set(key.id, key);
      log(`createKey ${key.id} (${name}) in ${usagePlanId}`);
      return info(key);
    },
    async getKeyValue(keyId) {
      assertNotProduction();
      return s().keys.get(keyId)?.value ?? null;
    },
    async setEnabled(keyId, enabled) {
      assertNotProduction();
      get(keyId).enabled = enabled;
      log(`${enabled ? "enableKey" : "disableKey"} ${keyId}`);
    },
    async addToPlan(keyId, usagePlanId) {
      assertNotProduction();
      get(keyId).plans.add(usagePlanId);
      log(`addToPlan ${keyId} ${usagePlanId}`);
    },
    async removeFromPlan(keyId, usagePlanId) {
      assertNotProduction();
      s().keys.get(keyId)?.plans.delete(usagePlanId);
      log(`removeFromPlan ${keyId} ${usagePlanId}`);
    },
    async getKeyPlans(keyId) {
      assertNotProduction();
      return [...(s().keys.get(keyId)?.plans ?? [])];
    },
  };
}

export function newFakeState(): FakeState {
  return { keys: new Map(), counter: 0 };
}

export function createFakeUsagePlanStore(): UsagePlanStore {
  const plan = (id: string): UsagePlanInfo => ({
    id,
    name: id,
    description: `Fake usage plan ${id}`,
    quota: null,
    throttle: null,
  });
  return {
    async listUsagePlans() {
      assertNotProduction();
      return [];
    },
    async getUsagePlan(id) {
      assertNotProduction();
      return plan(id);
    },
  };
}

/** A small, stable hash, so the fake's numbers are the same on every run. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Made-up daily usage for any key, so local usage pages show a believable
 * chart: about the last 120 days, quieter at weekends. The same key and
 * day always give the same numbers.
 */
export function fakeDailyStats(keyId: string, from: string, to: string, today: Date): DailyStat[] {
  const stats: DailyStat[] = [];
  const firstActive = today.getTime() - 120 * DAY_MS;
  const start = Math.max(Date.parse(`${from}T00:00:00Z`), firstActive);
  const end = Math.min(Date.parse(`${to}T00:00:00Z`), today.getTime());
  for (let t = start - (start % DAY_MS); t <= end; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    const h = hash(`${keyId}:${date}`);
    const weekend = [0, 6].includes(new Date(t).getUTCDay());
    if (h % 7 === 0) continue; // some days have no traffic
    const success = (h % 40) + (weekend ? 0 : 15);
    const notFound = (h >>> 8) % (weekend ? 3 : 7);
    stats.push({ date, success, notFound });
  }
  return stats;
}

export function createFakeUsageStatsStore(): UsageStatsStore {
  return {
    async readDailyStats(keyId, from, to) {
      assertNotProduction();
      return fakeDailyStats(keyId, from, to, new Date());
    },
  };
}
