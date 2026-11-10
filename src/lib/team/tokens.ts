import { createHash, randomBytes } from "node:crypto";

// Invite tokens (plan §6.6). The link carries a random token; the database
// keeps only its SHA-256, so a leaked table can't be used to join a team.

export function newInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Whether a token from a URL looks like one we could have issued. */
export function isPlausibleToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(token);
}
