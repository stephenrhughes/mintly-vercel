// View as customer (ADM-13): the session token. An admin's view-as session
// is a short-lived cookie naming the admin and the user being viewed,
// signed with HMAC-SHA256 so it can't be forged or pointed at someone else.
// Pure (node:crypto only), so it can be tested; view-as.ts reads and writes
// the cookie.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export { VIEW_AS_COOKIE } from "./view-as-guard";
/** A view-as session lasts an hour at most. */
export const VIEW_AS_SECONDS = 60 * 60;

export type ViewAsSession = { adminId: string; targetUserId: string; expiresAt: number };

type Env = Record<string, string | undefined>;

/**
 * The signing secret: VIEW_AS_SECRET, or else one derived from the Supabase
 * secret key, which is just as private and always set where admins work.
 */
export function viewAsSecret(env: Env = process.env): string | null {
  const explicit = env.VIEW_AS_SECRET?.trim();
  if (explicit) return explicit;
  const service = (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  return service ? createHash("sha256").update(`view-as:${service}`).digest("hex") : null;
}

const encode = (text: string) => Buffer.from(text).toString("base64url");
const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export function signViewAs(
  input: { adminId: string; targetUserId: string; now: Date },
  secret: string,
): string {
  const payload = encode(
    JSON.stringify({
      a: input.adminId,
      t: input.targetUserId,
      e: Math.floor(input.now.getTime() / 1000) + VIEW_AS_SECONDS,
    }),
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyViewAs(
  token: string | undefined,
  secret: string | null,
  now: Date,
): ViewAsSession | null {
  if (!token || !secret || token.length > 1000) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      a?: unknown;
      t?: unknown;
      e?: unknown;
    };
    if (typeof data.a !== "string" || typeof data.t !== "string" || typeof data.e !== "number") {
      return null;
    }
    if (data.e * 1000 <= now.getTime()) return null;
    return { adminId: data.a, targetUserId: data.t, expiresAt: data.e };
  } catch {
    return null;
  }
}
