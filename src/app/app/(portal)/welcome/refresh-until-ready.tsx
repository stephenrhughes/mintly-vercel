"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EVERY_MS = 2000;
const TRIES = 20;

/** Re-renders the page until the webhook has set the account up, then stops. */
export function RefreshUntilReady({ supportEmail }: { supportEmail: string }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (tries >= TRIES) return;
    const timer = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, EVERY_MS);
    return () => clearTimeout(timer);
  }, [router, tries]);

  if (tries >= TRIES) {
    return (
      <p className="text-sm text-muted-foreground">
        This is taking longer than usual. Refresh the page in a minute, or email {supportEmail} if
        it still isn&apos;t ready.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Setting up your account…
    </p>
  );
}
