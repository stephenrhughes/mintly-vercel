"use client";

import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { SIGNED_IN_HINT_COOKIE } from "@/lib/auth/hint-cookie";
import { salesToAppHref } from "@/lib/hosts";

/**
 * The only account links on the sales site (LAY-02): Sign in and Start free
 * trial for visitors, or Open app when the app's "signed in" hint cookie is
 * present (APP-06). The sales page itself never reads a session (APP-03).
 */
export function AccountLinks() {
  // Server rendering, and the static page, always show the visitor links.
  const signedIn = useSyncExternalStore(noSubscription, readHint, () => false);

  if (signedIn) {
    return (
      <Button asChild size="sm">
        <a href={salesToAppHref("/")}>Open app</a>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="ghost">
        <a href={salesToAppHref("/sign-in")}>Sign in</a>
      </Button>
      <Button asChild size="sm">
        <a href={salesToAppHref("/sign-up")}>Start free trial</a>
      </Button>
    </div>
  );
}

const noSubscription = () => () => {};

function readHint(): boolean {
  return document.cookie
    .split("; ")
    .some((cookie) => cookie.startsWith(`${SIGNED_IN_HINT_COOKIE}=1`));
}
