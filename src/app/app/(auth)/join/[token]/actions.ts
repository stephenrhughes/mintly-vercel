"use server";

import { redirect } from "next/navigation";

import type { FormState } from "@/lib/auth/errors";
import { requireUser } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";
import { createServiceClient } from "@/lib/supabase/admin";
import { acceptInvite } from "@/lib/team/operations";
import { joinErrorMessage } from "@/lib/team/rules";

// JOIN-01 to JOIN-05: accept an invite as the signed-in user. The database
// re-checks the email, expiry, subscription and seats under a lock, and
// moves someone from another organisation only with their consent.
export async function acceptInvitation(_state: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const user = await requireUser(`/join/${encodeURIComponent(token)}`);
  const move = formData.get("move") === "on";

  let result;
  try {
    result = await acceptInvite({ db: createServiceClient() }, { token, userId: user.id, move });
  } catch (error) {
    console.error("accepting the invite failed", error);
    return { error: "Something went wrong. Please try again." };
  }
  if (!result.ok) {
    if (result.hint === "already_member") redirect(appPath("/"));
    return {
      error: joinErrorMessage(result.hint, {
        orgName: String(formData.get("orgName") ?? "") || undefined,
        detail: result.detail,
      }),
    };
  }
  redirect(appPath("/?joined=1"));
}
