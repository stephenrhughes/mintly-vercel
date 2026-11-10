import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { requireSupabaseConfig } from "./config";

/**
 * A Supabase client acting as the signed-in user, for Server Components,
 * Server Actions and Route Handlers. RLS applies to everything it reads.
 */
export async function createClient() {
  const { url, publishableKey } = requireSupabaseConfig();
  // Supabase checks the session's expiry against the clock (Date.now()).
  // With Partial Prefetching, cookies() alone still lets data into the
  // prefetched App Shell, where reading the time is an error, so wait for
  // the real request first. A session is per request anyway, and permission
  // checks must never come from a prefetched copy.
  await connection();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. proxy.ts refreshes the
          // session on every app request, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * A client that keeps no session, for checks that mustn't touch the user's
 * cookies (for example confirming the current password, ACC-03).
 */
export function createSessionlessClient() {
  const { url, publishableKey } = requireSupabaseConfig();
  return createStatelessClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
