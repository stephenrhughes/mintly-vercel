import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { requireSupabaseConfig } from "./config";

/**
 * A Supabase client acting as the signed-in user, for Server Components,
 * Server Actions and Route Handlers. RLS applies to everything it reads.
 */
export async function createClient() {
  const { url, publishableKey } = requireSupabaseConfig();
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
