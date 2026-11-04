import "server-only";

import { cookies } from "next/headers";

// Remembers which address we just emailed a code to, between the sign-up or
// forgot-password form and the page where the code is entered, without
// putting the address in the URL.
const COOKIE = "mintly_pending_email";

export async function setPendingEmail(email: string) {
  (await cookies()).set(COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
}

export async function getPendingEmail(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function clearPendingEmail() {
  (await cookies()).delete(COOKIE);
}
