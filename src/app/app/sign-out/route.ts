import { type NextRequest, NextResponse } from "next/server";

import { hintCookieOptions, SIGNED_IN_HINT_COOKIE } from "@/lib/auth/hint-cookie";
import { clearPendingEmail } from "@/lib/auth/pending-email";
import { salesHomeUrl } from "@/lib/auth/urls";
import { appPath, safeNextPath } from "@/lib/hosts";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

// Signing out ends this session and returns to the sales home page (APP-07).
// POST only, so a link or prefetch can't sign anyone out. With `next` (the
// invite page, when the wrong account is signed in: JOIN-02) it goes to
// sign-in instead, to come back there.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const next = safeNextPath(String(form?.get("next") ?? ""));
  const email = String(form?.get("email") ?? "").slice(0, 254);

  if (getSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  await clearPendingEmail();

  const target =
    next === "/"
      ? salesHomeUrl()
      : appPath(
          `/sign-in?next=${encodeURIComponent(next)}${email ? `&email=${encodeURIComponent(email)}` : ""}`,
        );
  const response = NextResponse.redirect(new URL(target, request.url), 303);
  response.cookies.set(SIGNED_IN_HINT_COOKIE, "", { ...hintCookieOptions(), maxAge: 0 });
  return response;
}
