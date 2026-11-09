import type { EmailOtpType } from "@supabase/supabase-js";
import { after, type NextRequest, NextResponse } from "next/server";

import { notifyAdminOfNewUser } from "@/lib/auth/new-user-notice";

import { appPath, safeNextPath } from "@/lib/hosts";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const otpTypes = new Set<EmailOtpType>([
  "signup",
  "email",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
]);

// Where links in auth emails land (APP-04): sign-up confirmation (AUTH-03),
// password reset (AUTH-12) and, later, SSO (SSO-04). Handles both the PKCE
// `code` from Supabase's default links and `token_hash` links from custom
// email templates, then sends the user on into the app (APP-08).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const failure = NextResponse.redirect(new URL(appPath("/sign-in?error=link"), request.url));

  if (!getSupabaseConfig() || searchParams.has("error")) return failure;

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  let userId: string | null = null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    userId = data.user?.id ?? null;
  } else if (tokenHash && type && otpTypes.has(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
    userId = type === "signup" || type === "email" ? (data.user?.id ?? null) : null;
  }
  if (!ok) return failure;

  // AUTH-07: a confirmed sign-up. Sent once per user, so a recovery or
  // later link that lands here doesn't repeat it.
  if (userId && type !== "recovery") {
    const id = userId;
    after(() => notifyAdminOfNewUser(id));
  }

  return NextResponse.redirect(new URL(appPath(next), request.url));
}
