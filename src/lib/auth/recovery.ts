import type { AMREntry } from "@supabase/supabase-js";

// How long after following a reset link (or entering an emailed code) the
// user may set a new password without the code. Any other signed-in session
// has to use the code, or the current password on the Account page (ACC-03).
const RECOVERY_WINDOW_MS = 15 * 60 * 1000;
const emailMethods = new Set(["recovery", "otp", "magiclink"]);

export function isRecentEmailVerification(
  methods: AMREntry[] | string[] | undefined,
  now = Date.now(),
): boolean {
  return (methods ?? []).some(
    (entry) =>
      typeof entry !== "string" &&
      emailMethods.has(entry.method) &&
      now - entry.timestamp * 1000 < RECOVERY_WINDOW_MS,
  );
}
