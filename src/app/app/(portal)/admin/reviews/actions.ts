"use server";

import { refresh } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  addDomain,
  approve,
  askForInformation,
  decline,
  reinstate,
  removeDomain,
  type ReviewResult,
  suspend,
} from "@/lib/review/operations";
import { normaliseDomain } from "@/lib/review/rules";
import { reviewDeps } from "@/lib/review/server";

// Trial review decisions (plan §6.8, §6.11, APPR-05, APPR-08). Every action
// checks for an admin who has completed MFA (SEC-01), and every write is
// audited (by apply_review_decision, or addDomain and removeDomain).

export type ActionState = { error?: string; message?: string; warnings?: string[] };

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

function toState(result: ReviewResult): ActionState {
  if (!result.ok) return { error: result.error };
  return { message: result.message, warnings: result.warnings };
}

async function run(
  orgId: string,
  task: (adminId: string) => Promise<ReviewResult>,
): Promise<ActionState> {
  const admin = await requireAdmin(`/admin/reviews/${orgId}`);
  if (!isUuid(orgId)) return { error: "Organisation not found." };
  try {
    const result = await task(admin.id);
    refresh();
    return toState(result);
  } catch (error) {
    console.error("review action failed", error);
    return { error: "Something went wrong. Nothing more was changed; try again." };
  }
}

export async function approveReview(orgId: string, _state: ActionState, formData: FormData) {
  return run(orgId, (actorId) =>
    approve(reviewDeps(), { orgId, actorId, trustDomain: formData.get("trustDomain") === "on" }),
  );
}

export async function askForInformationReview(
  orgId: string,
  _state: ActionState,
  formData: FormData,
) {
  return run(orgId, (actorId) =>
    askForInformation(reviewDeps(), { orgId, actorId, message: text(formData, "message") }),
  );
}

export async function declineReview(orgId: string, _state: ActionState, formData: FormData) {
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  return run(orgId, (actorId) =>
    decline(reviewDeps(), { orgId, actorId, blockDomain: formData.get("blockDomain") === "on" }),
  );
}

export async function suspendOrganisation(orgId: string, _state: ActionState, formData: FormData) {
  return run(orgId, (actorId) =>
    suspend(reviewDeps(), { orgId, actorId, reason: text(formData, "reason") }),
  );
}

export async function reinstateOrganisation(orgId: string): Promise<ActionState> {
  return run(orgId, (actorId) => reinstate(reviewDeps(), { orgId, actorId }));
}

// Trusted and blocked domains (plan §6.11).
export async function addListedDomain(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin("/admin/reviews/domains");
  const list = formData.get("list") === "blocked" ? "blocked" : "trusted";
  const domain = normaliseDomain(text(formData, "domain"));
  if (!domain) return { error: "Enter a domain, for example acme.co.uk." };
  try {
    await addDomain(createServiceClient(), {
      list,
      domain,
      reason: text(formData, "reason") || null,
      actorId: admin.id,
    });
  } catch (error) {
    console.error("adding a domain failed", error);
    return { error: `We couldn't add ${domain}. Try again.` };
  }
  refresh();
  return { message: `${domain} is ${list === "trusted" ? "trusted" : "blocked"}.` };
}

export async function removeListedDomain(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/reviews/domains");
  const list = formData.get("list") === "blocked" ? "blocked" : "trusted";
  const domain = normaliseDomain(text(formData, "domain"));
  if (!domain) return;
  await removeDomain(createServiceClient(), { list, domain, actorId: admin.id });
  refresh();
}
