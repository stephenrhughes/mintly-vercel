import { appUrl, getAppHost } from "@/lib/hosts";
import { getSiteUrl } from "@/lib/site";

/** Where auth emails link back to: the app's callback, carrying `next` (APP-04). */
export function authCallbackUrl(next: string): string {
  return appUrl(`/auth/callback?next=${encodeURIComponent(next)}`);
}

/** The sales home page, where signing out lands (APP-07). */
export function salesHomeUrl(): string {
  return getAppHost() ? `${getSiteUrl()}/` : "/";
}
