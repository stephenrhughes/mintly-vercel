// Security headers (WEB-04) and the two Content-Security-Policies: one for
// the sales site, which loads the third parties in plan §2 and §6.10, and a
// tighter one for the app (APP-10). Both are static allowlists rather than
// nonces, because a nonce makes every page render per request and the
// sales pages are prerendered (plan §6.10). Without a nonce Next.js needs
// 'unsafe-inline' for its inline scripts; 'unsafe-eval' is development only.

type Env = Record<string, string | undefined>;

type Directives = Record<string, string[]>;

const google = [
  "https://www.googletagmanager.com",
  "https://*.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://googleads.g.doubleclick.net",
  "https://*.doubleclick.net",
  "https://www.googleadservices.com",
  "https://www.google.com",
  "https://www.google.co.uk",
];
const recaptcha = ["https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"];
const meta = ["https://connect.facebook.net", "https://www.facebook.com"];
const clarity = ["https://*.clarity.ms", "https://c.bing.com"];
const tawk = ["https://embed.tawk.to", "https://*.tawk.to", "https://tawk.link"];
const cal = ["https://app.cal.com", "https://cal.com", "https://*.cal.com"];

function supabaseOrigins(env: Env): string[] {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return [];
  const { origin, host } = new URL(url);
  return [origin, `wss://${host}`];
}

function serialise(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}

function scriptSrc(env: Env, extra: string[]): string[] {
  const dev = env.NODE_ENV === "development" ? ["'unsafe-eval'"] : [];
  return ["'self'", "'unsafe-inline'", ...dev, ...extra];
}

export function salesCsp(env: Env = process.env): string {
  return serialise({
    "default-src": ["'self'"],
    "script-src": scriptSrc(env, [...google, ...recaptcha, ...meta, ...clarity, ...tawk, ...cal]),
    "style-src": ["'self'", "'unsafe-inline'", "https://embed.tawk.to", "https://cal.com", ...cal],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      ...google,
      "https://www.gstatic.com",
      ...meta,
      ...clarity,
      ...tawk,
      ...cal,
      "https://cdn.jsdelivr.net",
      "https://cdn-b.saashub.com",
      "https://static-files.saasbrowser.com",
      "https://cdn.redoc.ly",
    ],
    "font-src": ["'self'", "data:", "https://*.tawk.to", ...cal],
    "connect-src": [
      "'self'",
      ...google,
      ...recaptcha,
      ...meta,
      ...clarity,
      ...tawk,
      "wss://*.tawk.to",
      ...cal,
    ],
    "frame-src": [
      "https://www.google.com",
      "https://www.googletagmanager.com",
      "https://td.doubleclick.net",
      "https://www.youtube.com",
      "https://www.youtube-nocookie.com",
      "https://embed.tawk.to",
      ...cal,
    ],
    // ReDoc runs its search index in a blob: worker.
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'self'", "https://embed.tawk.to"],
    "form-action": ["'self'"],
    // Google's search preview may frame the site, as on the old site.
    "frame-ancestors": ["'self'", "https://www.google.com"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "upgrade-insecure-requests": [],
  });
}

export function appCsp(env: Env = process.env): string {
  const supabase = supabaseOrigins(env);
  return serialise({
    "default-src": ["'self'"],
    "script-src": scriptSrc(env, recaptcha),
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...supabase, ...recaptcha],
    "frame-src": ["https://www.google.com"],
    "form-action": ["'self'", "https://checkout.stripe.com", "https://billing.stripe.com"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "upgrade-insecure-requests": [],
  });
}

// Matching the old site's customHttp.yml.
const baseHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

type HeaderRule = {
  source: string;
  has?: { type: "host"; value: string }[];
  missing?: { type: "host"; value: string }[];
  headers: { key: string; value: string }[];
};

/** The app's own host, when it has one (see src/lib/hosts.ts). */
function appHost(env: Env): string | null {
  const value = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!value) return null;
  const url = new URL(value.replace(/\/+$/, ""));
  return url.pathname === "/" || url.pathname === "" ? url.host : null;
}

/**
 * The header rules for next.config.ts. The app gets its CSP on its own host,
 * or under /app in path mode; everything else gets the sales CSP.
 */
export function securityHeaderRules(
  env: Env = process.env,
  extra: { key: string; value: string }[] = [],
): HeaderRule[] {
  const host = appHost(env);
  const common = [...baseHeaders, ...extra];
  const sales = { key: "Content-Security-Policy", value: salesCsp(env) };
  const app = { key: "Content-Security-Policy", value: appCsp(env) };
  const hostPattern = host?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (hostPattern) {
    return [
      {
        source: "/:path*",
        missing: [{ type: "host", value: hostPattern }],
        headers: [...common, sales],
      },
      { source: "/:path*", has: [{ type: "host", value: hostPattern }], headers: [...common, app] },
    ];
  }
  return [
    { source: "/((?!app$|app/).*)", headers: [...common, sales] },
    { source: "/app", headers: [...common, app] },
    { source: "/app/:path*", headers: [...common, app] },
  ];
}
