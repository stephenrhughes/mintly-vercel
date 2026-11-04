// A non-sensitive "signed in" hint for the sales site (APP-06). It holds no
// identity and no token; the sales header only uses it to show "Open app"
// instead of "Sign in". It is set on the parent domain (for example
// .mintly.uk) so the sales host can see it, while the session cookie itself
// stays host-only on the app host (APP-03).

export const SIGNED_IN_HINT_COOKIE = "mintly_signed_in";

type Env = Record<string, string | undefined>;

export function hintCookieOptions(env: Env = process.env) {
  const domain = env.SIGNED_IN_HINT_COOKIE_DOMAIN?.trim() || undefined;
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
    ...(domain ? { domain } : {}),
  };
}
