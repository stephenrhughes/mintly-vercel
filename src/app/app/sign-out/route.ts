import { type NextRequest, NextResponse } from "next/server";

import { hintCookieOptions, SIGNED_IN_HINT_COOKIE } from "@/lib/auth/hint-cookie";
import { clearPendingEmail } from "@/lib/auth/pending-email";
import { salesHomeUrl } from "@/lib/auth/urls";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

// Signing out ends this session and returns to the sales home page (APP-07).
// POST only, so a link or prefetch can't sign anyone out.
export async function POST(request: NextRequest) {
  if (getSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  await clearPendingEmail();

  const response = NextResponse.redirect(new URL(salesHomeUrl(), request.url), 303);
  response.cookies.set(SIGNED_IN_HINT_COOKIE, "", { ...hintCookieOptions(), maxAge: 0 });
  return response;
}
