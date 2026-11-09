import "server-only";

import { createHmac } from "node:crypto";

import { getDeploymentEnvironment } from "@/lib/site";

// Where a checkout came from, for the review queue (APPR-04). The IP is
// kept only as a keyed hash (plan §9: IPs are hashed), which is enough to
// spot repeated trials from one address without storing the address.

type Env = Record<string, string | undefined>;

export function hashIp(ip: string, env: Env = process.env): string | null {
  const secret = env.IP_HASH_SECRET?.trim();
  if (!secret) {
    if (getDeploymentEnvironment(env) === "production") {
      console.error("IP_HASH_SECRET is not set; sign-up IPs aren't recorded.");
      return null;
    }
    // Development and previews: a fixed key, so matching still works.
    return createHmac("sha256", "mintly-development").update(ip).digest("hex").slice(0, 32);
  }
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

export type RequestSignals = { signup_ip_hash?: string; signup_country?: string };

/** The hashed IP and country of the request, from Vercel's headers. */
export function requestSignals(headers: Headers, env: Env = process.env): RequestSignals {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "";
  const country = headers.get("x-vercel-ip-country")?.trim().toUpperCase() ?? "";
  const ipHash = ip ? hashIp(ip, env) : null;
  return {
    ...(ipHash ? { signup_ip_hash: ipHash } : {}),
    ...(/^[A-Z]{2}$/.test(country) ? { signup_country: country } : {}),
  };
}
