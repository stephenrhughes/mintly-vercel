// Links into the Stripe dashboard for admins (ADM-03): test-mode links
// unless the app runs on a live key.

type Kind = "customers" | "subscriptions" | "prices" | "invoices";

export function stripeDashboardUrl(
  kind: Kind,
  id: string,
  secretKey: string | undefined = process.env.STRIPE_SECRET_KEY,
): string {
  const live = Boolean(secretKey?.startsWith("sk_live_") || secretKey?.startsWith("rk_live_"));
  return `https://dashboard.stripe.com/${live ? "" : "test/"}${kind}/${encodeURIComponent(id)}`;
}
