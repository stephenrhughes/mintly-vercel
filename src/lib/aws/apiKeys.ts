import "server-only";

import {
  ConflictException,
  CreateApiKeyCommand,
  CreateUsagePlanKeyCommand,
  DeleteUsagePlanKeyCommand,
  GetApiKeyCommand,
  GetApiKeysCommand,
  GetUsagePlansCommand,
  NotFoundException,
  UpdateApiKeyCommand,
} from "@aws-sdk/client-api-gateway";

import { getApiGatewayClient, getAwsRoleArn } from "./client";
import { createFakeApiKeyStore } from "./fake";
import type { ApiKeyInfo, ApiKeyStore } from "./types";

// API Gateway keys (plan §7): create, read the value, enable, disable, and
// move between usage plans. rotateKey arrives with KEY-01 (phase 2c).

function toInfo(key: { id?: string; name?: string; enabled?: boolean }): ApiKeyInfo {
  return { id: key.id ?? "", name: key.name ?? "", enabled: Boolean(key.enabled) };
}

const ignore =
  (...types: Array<new (...args: never[]) => Error>) =>
  (error: unknown) => {
    if (types.some((type) => error instanceof type)) return;
    throw error;
  };

function createAwsApiKeyStore(): ApiKeyStore {
  const client = () => getApiGatewayClient();
  return {
    async findKeyByName(name) {
      // nameQuery is a prefix match, so check the name exactly.
      const { items = [] } = await client().send(
        new GetApiKeysCommand({ nameQuery: name, includeValues: false, limit: 50 }),
      );
      const key = items.find((item) => item.name === name);
      return key ? toInfo(key) : null;
    },
    async createKey({ name, usagePlanId, tags }) {
      const key = await client().send(new CreateApiKeyCommand({ name, enabled: true, tags }));
      await client()
        .send(new CreateUsagePlanKeyCommand({ usagePlanId, keyId: key.id, keyType: "API_KEY" }))
        .catch(ignore(ConflictException));
      return toInfo(key);
    },
    async getKeyValue(keyId) {
      try {
        const key = await client().send(
          new GetApiKeyCommand({ apiKey: keyId, includeValue: true }),
        );
        return key.value ?? null;
      } catch (error) {
        if (error instanceof NotFoundException) return null;
        throw error;
      }
    },
    async setEnabled(keyId, enabled) {
      await client().send(
        new UpdateApiKeyCommand({
          apiKey: keyId,
          patchOperations: [{ op: "replace", path: "/enabled", value: String(enabled) }],
        }),
      );
    },
    async addToPlan(keyId, usagePlanId) {
      await client()
        .send(new CreateUsagePlanKeyCommand({ usagePlanId, keyId, keyType: "API_KEY" }))
        .catch(ignore(ConflictException));
    },
    async removeFromPlan(keyId, usagePlanId) {
      await client()
        .send(new DeleteUsagePlanKeyCommand({ usagePlanId, keyId }))
        .catch(ignore(NotFoundException));
    },
    async getKeyPlans(keyId) {
      const plans: string[] = [];
      let position: string | undefined;
      do {
        const page = await client().send(new GetUsagePlansCommand({ keyId, position, limit: 100 }));
        for (const plan of page.items ?? []) if (plan.id) plans.push(plan.id);
        position = page.position;
      } while (position);
      return plans;
    },
  };
}

let store: ApiKeyStore | null = null;

/** The key store for this deployment: API Gateway, or the fake without AWS_ROLE_ARN. */
export function apiKeyStore(): ApiKeyStore {
  store ??= getAwsRoleArn() ? createAwsApiKeyStore() : createFakeApiKeyStore();
  return store;
}

/** The name a subscription item's key is created with, so a retry finds it (NFR-04). */
export function keyNameFor(subscriptionItemId: string): string {
  return `v2-${subscriptionItemId}`;
}

export const getKeyValue = (keyId: string) => apiKeyStore().getKeyValue(keyId);
export const getKeyPlans = (keyId: string) => apiKeyStore().getKeyPlans(keyId);

export async function enableKey(keyId: string, usagePlanId: string) {
  await apiKeyStore().addToPlan(keyId, usagePlanId);
  await apiKeyStore().setEnabled(keyId, true);
}

export async function disableKey(keyId: string, usagePlanId: string | null) {
  await apiKeyStore().setEnabled(keyId, false);
  if (usagePlanId) await apiKeyStore().removeFromPlan(keyId, usagePlanId);
}

/** Adds to the new plan before leaving the old one, so the key never has no plan. */
export async function moveKey(keyId: string, from: string | null, to: string) {
  await apiKeyStore().addToPlan(keyId, to);
  if (from && from !== to) await apiKeyStore().removeFromPlan(keyId, from);
}
