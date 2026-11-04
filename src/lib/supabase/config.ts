// Supabase project settings. The publishable (anon) key is safe in the
// browser; RLS decides what it can read. The secret key is never used here.

type Env = Record<string, string | undefined>;

export type SupabaseConfig = { url: string; publishableKey: string };

/** The project URL and publishable key, or null when Supabase isn't configured. */
export function getSupabaseConfig(env: Env = process.env): SupabaseConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // Older projects call the publishable key the anon key.
  const publishableKey = (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  return url && publishableKey ? { url, publishableKey } : null;
}

export function requireSupabaseConfig(env: Env = process.env): SupabaseConfig {
  const config = getSupabaseConfig(env);
  if (!config) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  return config;
}
