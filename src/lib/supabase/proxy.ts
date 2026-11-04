import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

import { getSupabaseConfig } from "./config";

export type PendingCookie = { name: string; value: string; options: Record<string, unknown> };

/**
 * Refreshes the Supabase session for an app request. The refreshed cookies
 * are written onto `request` (so Server Components in this request see
 * them) and returned, to be copied onto the response.
 *
 * This is an optimistic check for redirects only. Pages and actions verify
 * the user again through the data access layer (src/lib/auth/session.ts).
 */
export async function refreshSession(request: NextRequest): Promise<{
  signedIn: boolean;
  cookies: PendingCookie[];
  headers: Record<string, string>;
}> {
  const config = getSupabaseConfig();
  const pending: PendingCookie[] = [];
  const headers: Record<string, string> = {};
  if (!config) return { signedIn: false, cookies: pending, headers };

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          pending.push({ name, value, options });
        }
        Object.assign(headers, cacheHeaders);
      },
    },
  });

  // getClaims() verifies the JWT and refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  return { signedIn: Boolean(data?.claims?.sub), cookies: pending, headers };
}
