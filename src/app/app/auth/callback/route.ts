import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

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
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && otpTypes.has(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  if (!ok) return failure;

  return NextResponse.redirect(new URL(appPath(next), request.url));
}
