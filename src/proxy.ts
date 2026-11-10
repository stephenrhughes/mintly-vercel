import { type NextRequest, NextResponse } from "next/server";

import { VIEW_AS_COOKIE, viewAsBlocksRequest } from "@/lib/admin/view-as-guard";
import { hintCookieOptions, SIGNED_IN_HINT_COOKIE } from "@/lib/auth/hint-cookie";
import {
  APP_NOT_FOUND_PATH,
  APP_ROUTE_PREFIX,
  appPath,
  isKnownAppPath,
  isProtectedAppPath,
  routeRequest,
  safeNextPath,
} from "@/lib/hosts";
import { refreshSession } from "@/lib/supabase/proxy";

// Routes requests between the sales site and the app by hostname
// (APP-01, APP-09, APP-12), and keeps the Supabase session fresh on app
// requests only, so sales pages never read or set a session (APP-03).
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const decision = routeRequest({ host, pathname, search });

  switch (decision.type) {
    case "sales":
      return NextResponse.next();
    case "redirect":
      return NextResponse.redirect(
        new URL(decision.location, request.url),
        decision.permanent ? 308 : 307,
      );
    case "not-found":
      // No such route exists, so this renders the 404 page with a 404 status.
      return NextResponse.rewrite(new URL("/_not-found-on-this-host", request.url));
  }

  const { appPathname } = decision;
  if (!isKnownAppPath(appPathname)) {
    const response = NextResponse.rewrite(
      new URL(`${APP_ROUTE_PREFIX}${APP_NOT_FOUND_PATH}`, request.url),
    );
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  // ADM-13: while an admin views the portal as a customer, nothing can be
  // changed: every write, Server Actions included, is refused here.
  if (
    viewAsBlocksRequest({
      method: request.method,
      appPathname,
      hasViewAsCookie: request.cookies.has(VIEW_AS_COOKIE),
    })
  ) {
    return new NextResponse(
      "You're viewing as a customer, so nothing can be changed. Exit first.",
      {
        status: 403,
        headers: { "X-Robots-Tag": "noindex, nofollow" },
      },
    );
  }

  const session = await refreshSession(request);

  let response: NextResponse;
  if (!session.signedIn && isProtectedAppPath(appPathname)) {
    const next = safeNextPath(`${appPathname}${search}`);
    const target = next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;
    response = NextResponse.redirect(new URL(appPath(target), request.url));
  } else if (session.signedIn && (appPathname === "/sign-in" || appPathname === "/sign-up")) {
    // Already signed in: go straight into the app (APP-08).
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    response = NextResponse.redirect(new URL(appPath(next), request.url));
  } else if (decision.rewrite) {
    response = NextResponse.rewrite(new URL(`${decision.rewrite}${search}`, request.url), {
      request: { headers: request.headers },
    });
  } else {
    response = NextResponse.next({ request: { headers: request.headers } });
  }

  for (const { name, value, options } of session.cookies) {
    response.cookies.set(name, value, options);
  }
  for (const [key, value] of Object.entries(session.headers)) {
    response.headers.set(key, value);
  }

  const hasHint = request.cookies.has(SIGNED_IN_HINT_COOKIE);
  if (session.signedIn && !hasHint) {
    response.cookies.set(SIGNED_IN_HINT_COOKIE, "1", hintCookieOptions());
  } else if (!session.signedIn && hasHint) {
    response.cookies.set(SIGNED_IN_HINT_COOKIE, "", { ...hintCookieOptions(), maxAge: 0 });
  }

  // The app is never indexed (APP-10).
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Everything except API routes, Next.js internals and static files.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest)$).*)",
  ],
};
