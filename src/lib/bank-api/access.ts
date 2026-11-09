// Who may make checks on the Tools page, and how (plan §6.2 step 1, TOOL-01,
// APPR-03). Pure, so the rules are unit-tested; access-server.ts reads the
// facts it needs.

import { describeSubscription, type SubscriptionView } from "@/lib/billing/status";
import type { ReviewStatus } from "@/lib/nav";
import { getDeploymentEnvironment, siteConfig } from "@/lib/site";

/** Delay between calls on Starter and trial plans, and otherwise (TOOL-09). */
export const SLOW_PACING_MS = 500;
export const FAST_PACING_MS = 20;

export type CheckAccess =
  | { mode: "denied"; reason: string }
  | {
      mode: "sandbox";
      orgId: string;
      pacingMs: number;
      trialing: true;
      canDownload: false;
    }
  | {
      mode: "production";
      orgId: string;
      keyId: string;
      pacingMs: number;
      trialing: boolean;
      /** CSV download of bulk results is for paid plans (TOOL-11). */
      canDownload: boolean;
    };

export function decideAccess(input: {
  membership: { orgId: string; reviewStatus: ReviewStatus } | null;
  /** The organisation's Bank Account Checker subscription, if it has one. */
  subscription: SubscriptionView | null;
  /** The price's tier metadata (plan §6.5), if known. */
  tier: string | null;
}): CheckAccess {
  const { membership, subscription } = input;
  if (!membership) return { mode: "denied", reason: "Choose a plan to start using the tools." };

  switch (membership.reviewStatus) {
    case "pending_review":
      // APPR-03: no production checks until approved; the sandbox instead.
      return {
        mode: "sandbox",
        orgId: membership.orgId,
        pacingMs: SLOW_PACING_MS,
        trialing: true,
        canDownload: false,
      };
    case "rejected":
      return { mode: "denied", reason: "Your account wasn't approved." };
    case "suspended":
      return {
        mode: "denied",
        reason: `Your account is suspended. Email ${siteConfig.supportEmail} for help.`,
      };
  }

  // TOOL-01: a live Bank Account Checker subscription with an enabled key.
  if (!subscription || subscription.product !== "bank_checker") {
    return { mode: "denied", reason: "Your organisation has no Bank Account Checker plan." };
  }
  if (subscription.expired) {
    return { mode: "denied", reason: "Your subscription has ended." };
  }
  if (!subscription.apiKeyId || !describeSubscription(subscription).active) {
    return { mode: "denied", reason: "Your subscription has no active API key." };
  }

  const slow = subscription.trialing || input.tier === "starter";
  return {
    mode: "production",
    orgId: membership.orgId,
    keyId: subscription.apiKeyId,
    pacingMs: slow ? SLOW_PACING_MS : FAST_PACING_MS,
    trialing: subscription.trialing,
    canDownload: !subscription.trialing,
  };
}

type Env = Record<string, string | undefined>;

const PRODUCTION_API = `${siteConfig.apiBaseUrl}/bankAccount/v1`;
export const SANDBOX_API = `${siteConfig.sandboxBaseUrl}/bankAccount/v1`;

/**
 * The API the Tools proxy calls with an organisation's own key.
 * BANK_API_URL replaces it outside production, for example the sandbox API
 * on staging, whose keys live in test usage plans (plan §10.4).
 */
export function productionApiUrl(env: Env = process.env): string {
  const override = env.BANK_API_URL?.trim();
  if (override && getDeploymentEnvironment(env) !== "production") {
    return override.replace(/\/+$/, "");
  }
  return PRODUCTION_API;
}

export function hasApiOverride(env: Env = process.env): boolean {
  return Boolean(env.BANK_API_URL?.trim()) && getDeploymentEnvironment(env) !== "production";
}

/** The Mintly-held sandbox key for pending organisations (APPR-03, plan §13). */
export function sandboxApiKey(env: Env = process.env): string | null {
  return env.SANDBOX_API_KEY?.trim() || null;
}
