import "server-only";

import {
  GetUsagePlanCommand,
  GetUsagePlansCommand,
  NotFoundException,
} from "@aws-sdk/client-api-gateway";

import { getApiGatewayClient, getAwsRoleArn } from "./client";
import { createFakeUsagePlanStore } from "./fake";
import type { UsagePlanInfo, UsagePlanStore } from "./types";

// API Gateway usage plans (plan §7), for the plans health page (ADM-08) and
// checks that a price's metadata points at a real plan.

type AwsUsagePlan = {
  id?: string;
  name?: string;
  description?: string;
  quota?: { limit?: number; period?: string };
  throttle?: { rateLimit?: number; burstLimit?: number };
};

function toInfo(plan: AwsUsagePlan): UsagePlanInfo {
  return {
    id: plan.id ?? "",
    name: plan.name ?? "",
    description: plan.description ?? null,
    quota: plan.quota?.limit ? { limit: plan.quota.limit, period: plan.quota.period ?? "" } : null,
    throttle: plan.throttle
      ? { rateLimit: plan.throttle.rateLimit ?? null, burstLimit: plan.throttle.burstLimit ?? null }
      : null,
  };
}

function createAwsUsagePlanStore(): UsagePlanStore {
  return {
    async listUsagePlans() {
      const plans: UsagePlanInfo[] = [];
      let position: string | undefined;
      do {
        const page = await getApiGatewayClient().send(
          new GetUsagePlansCommand({ position, limit: 100 }),
        );
        plans.push(...(page.items ?? []).map(toInfo));
        position = page.position;
      } while (position);
      return plans;
    },
    async getUsagePlan(id) {
      try {
        return toInfo(
          await getApiGatewayClient().send(new GetUsagePlanCommand({ usagePlanId: id })),
        );
      } catch (error) {
        if (error instanceof NotFoundException) return null;
        throw error;
      }
    },
  };
}

let store: UsagePlanStore | null = null;

function usagePlanStore(): UsagePlanStore {
  store ??= getAwsRoleArn() ? createAwsUsagePlanStore() : createFakeUsagePlanStore();
  return store;
}

export const listUsagePlans = () => usagePlanStore().listUsagePlans();
export const getUsagePlan = (id: string) => usagePlanStore().getUsagePlan(id);
