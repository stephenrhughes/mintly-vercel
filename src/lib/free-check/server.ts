import "server-only";

import { createFakeTransport } from "@/lib/bank-api/fake";
import { productionApiUrl } from "@/lib/bank-api/access";
import { createHttpTransport } from "@/lib/bank-api/transport";
import { verifyCaptcha } from "@/lib/captcha";
import type { FreeCheckDeps, TakeResult } from "@/lib/free-check/check";
import { FREE_CHECK_WEEKLY_LIMIT } from "@/lib/free-check/limits";
import { hashIp } from "@/lib/review/request-signals";
import { getDeploymentEnvironment } from "@/lib/site";
import { createServiceClient, getServiceKey } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";

// The real dependencies of the free checker (plan §6.9).

/** The visitor's IP, from Vercel's headers. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || ""
  );
}

/**
 * FREE-05: a dedicated key held on the server (the old one was in source
 * and must be rotated). Without it, development and previews answer like
 * the sandbox; production refuses.
 */
async function freeCheckerTransport() {
  const key = process.env.FREE_CHECKER_API_KEY?.trim();
  if (key) return createHttpTransport({ baseUrl: productionApiUrl(), key });
  if (getDeploymentEnvironment() !== "production") return createFakeTransport();
  throw new Error("FREE_CHECKER_API_KEY is not set");
}

/** In-memory limits for local development without Supabase. */
const devCounts = new Map<string, { count: number; at: number }>();
function devTake(ipHash: string): TakeResult {
  const now = Date.now();
  const entry = devCounts.get(ipHash) ?? { count: 0, at: 0 };
  if (entry.count >= FREE_CHECK_WEEKLY_LIMIT) return { result: "weekly_limit", used: entry.count };
  if (now - entry.at < 2000) return { result: "too_fast", used: entry.count };
  devCounts.set(ipHash, { count: entry.count + 1, at: now });
  return { result: "ok", used: entry.count + 1 };
}

export function freeCheckDeps(request: Request): FreeCheckDeps {
  const ip = clientIp(request.headers);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const ipHash = hashIp(ip || "unknown") ?? "unknown";
  return {
    verifyCaptcha: (token) =>
      verifyCaptcha(token, { action: "free_check", hostnames: [host], remoteIp: ip || null }),
    take: async () => {
      if (!getSupabaseConfig() || !getServiceKey()) {
        if (getDeploymentEnvironment() === "production")
          throw new Error("Supabase is not configured");
        return devTake(ipHash);
      }
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .rpc("free_check_take", { p_ip_hash: ipHash })
        .single<TakeResult>();
      if (error || !data) throw new Error(error?.message ?? "free_check_take returned nothing");
      return data;
    },
    transport: freeCheckerTransport,
  };
}
