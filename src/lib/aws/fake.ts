// An in-memory stand-in for API Gateway, used when AWS_ROLE_ARN is unset
// (local development, CI and previews before the staging role exists). It
// refuses to run in production. State lives on globalThis so it survives
// hot reloads in `next dev`; it is lost when the server restarts.

import { getDeploymentEnvironment } from "@/lib/site";

import type { ApiKeyInfo, ApiKeyStore, UsagePlanInfo, UsagePlanStore } from "./types";

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
        id: `fakekey${n}`,
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
