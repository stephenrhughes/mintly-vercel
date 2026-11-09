import "server-only";

import Stripe from "stripe";

import { getDeploymentEnvironment } from "@/lib/site";

// The Stripe client (plan §5). Server only: the secret key never reaches the
// browser. Checkout and the billing portal redirect to Stripe-hosted pages,
// so no publishable key is needed either.

type Env = Record<string, string | undefined>;

/**
 * Whether a secret key may be used on this deployment. Live keys work only on
 * production, so previews and local copies can never charge a real customer
 * (NFR-03).
 */
export function isAllowedStripeKey(key: string, env: Env = process.env): boolean {
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) {
    return getDeploymentEnvironment(env) === "production";
  }
  return true;
}

/**
 * A local Stripe mock to send requests to instead, for development and
 * tests only (STRIPE_API_URL, such as http://localhost:12111). Ignored on
 * production.
 */
export function mockApiConfig(env: Env = process.env) {
  const value = env.STRIPE_API_URL?.trim();
  if (!value || getDeploymentEnvironment(env) === "production") return {};
  const url = new URL(value);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    protocol: url.protocol.replace(":", "") as "http" | "https",
  };
}

let cached: { key: string; client: Stripe } | null = null;

/** The Stripe client, or null when Stripe isn't configured on this deployment. */
export function getStripe(env: Env = process.env): Stripe | null {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!isAllowedStripeKey(key, env)) {
    throw new Error("A live Stripe key is set outside production. Use a test or sandbox key.");
  }
  if (cached?.key !== key) {
    cached = {
      key,
      client: new Stripe(key, {
        // Pinned, so a Stripe upgrade can't change payloads under us. The
        // subscription record code is written against this version.
        apiVersion: "2026-10-28.endive",
        appInfo: { name: "mintly-app" },
        maxNetworkRetries: 2,
        ...mockApiConfig(env),
      }),
    };
  }
  return cached.client;
}

export function requireStripe(env: Env = process.env): Stripe {
  const stripe = getStripe(env);
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not set (see .env.example).");
  return stripe;
}
