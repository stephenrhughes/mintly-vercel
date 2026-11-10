import { timingSafeEqual } from "node:crypto";

// Vercel Cron calls /api/cron/* with `Authorization: Bearer $CRON_SECRET`
// (plan §8). Anything else is refused.
export function isCronRequest(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const secret = env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
