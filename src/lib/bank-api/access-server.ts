import "server-only";

import { getAwsRoleArn } from "@/lib/aws/client";
import { getKeyValue } from "@/lib/aws/apiKeys";
import type { AppUser } from "@/lib/auth/session";
import { getOrgSubscriptions } from "@/lib/billing/queries";
import { priceMeta } from "@/lib/billing/subscription-record";
import { getDeploymentEnvironment } from "@/lib/site";
import { getPrice } from "@/lib/stripe/catalogue";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/admin";

import {
  type CheckAccess,
  decideAccess,
  hasApiOverride,
  productionApiUrl,
  SANDBOX_API,
  sandboxApiKey,
} from "./access";
import { createFakeTransport } from "./fake";
import type { LogEntry } from "./run";
import { type BankTransport, createHttpTransport } from "./transport";

// The Tools proxy's server side (plan §6.2): who may check, which key to
// call with, and the check log.

/** The organisation's check access, read as the signed-in user (RLS). */
export async function resolveCheckAccess(user: AppUser): Promise<CheckAccess> {
  const membership = user.membership;
  if (!membership || membership.reviewStatus !== "approved") {
    return decideAccess({ membership, subscription: null, tier: null });
  }
  const { current } = await getOrgSubscriptions(membership.orgId);
  const subscription = current.find((s) => s.product === "bank_checker") ?? null;
  return decideAccess({
    membership,
    subscription,
    tier: subscription ? await tierFor(subscription.stripePriceId) : null,
  });
}

async function tierFor(priceId: string): Promise<string | null> {
  if (!getStripe()) return null;
  try {
    return priceMeta(await getPrice(priceId)).tier;
  } catch (error) {
    console.error("reading the price for pacing failed", priceId, error);
    return null;
  }
}

// Key values, cached briefly on this server instance (plan §6.2 step 2).
// Keyed by key ID, which the subscription gives afresh on every request, so
// a rotated key is used at once (KEY-01).
const KEY_TTL_MS = 5 * 60 * 1000;
const keyCache = new Map<string, { value: string; expires: number }>();

async function keyValue(keyId: string): Promise<string> {
  const cached = keyCache.get(keyId);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = await getKeyValue(keyId);
  if (!value) throw new Error(`API key ${keyId} has no value`);
  keyCache.set(keyId, { value, expires: Date.now() + KEY_TTL_MS });
  return value;
}

const notProduction = () => getDeploymentEnvironment() !== "production";

/** How to reach the API for this access. The key stays inside the transport. */
export async function transportFor(
  access: Exclude<CheckAccess, { mode: "denied" }>,
): Promise<BankTransport> {
  if (access.mode === "sandbox") {
    const key = sandboxApiKey();
    if (key) return createHttpTransport({ baseUrl: SANDBOX_API, key });
    if (notProduction()) return createFakeTransport();
    throw new Error("SANDBOX_API_KEY is not set");
  }
  // With the fake API Gateway the key is made up, so the real API would
  // refuse it: answer like the sandbox instead (development and CI only).
  if (!getAwsRoleArn() && !hasApiOverride() && notProduction()) return createFakeTransport();
  return createHttpTransport({ baseUrl: productionApiUrl(), key: await keyValue(access.keyId) });
}

/** Writes check_log rows (plan §4). Users can't write it, so the server does. */
export function checkLogger(
  access: Exclude<CheckAccess, { mode: "denied" }>,
  userId: string,
  mode: "single" | "bulk",
) {
  return async (entries: LogEntry[]) => {
    const { error } = await createServiceClient()
      .from("check_log")
      .insert(
        entries.map((entry) => ({
          org_id: access.orgId,
          user_id: userId,
          kind: entry.kind,
          outcome: entry.outcome,
          mode,
          sandbox: access.mode === "sandbox",
        })),
      );
    if (error) throw new Error(error.message);
  };
}
