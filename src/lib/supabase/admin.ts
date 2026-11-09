import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabaseConfig } from "./config";

// A Supabase client using the secret (service role) key. It bypasses RLS, so
// it is only for server code that has already checked permission
// explicitly: the Stripe webhook, provisioning, and later admin actions
// (plan §4, §9). Never import it from a Client Component.

type Env = Record<string, string | undefined>;

export function getServiceKey(env: Env = process.env): string | null {
  // Older projects call the secret key the service role key.
  return (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY)?.trim() || null;
}

export function createServiceClient(env: Env = process.env) {
  const { url } = requireSupabaseConfig(env);
  const key = getServiceKey(env);
  if (!key) {
    throw new Error("SUPABASE_SECRET_KEY is not set (see .env.example).");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
