"use server";

import { randomUUID } from "node:crypto";

import type { ActionState } from "@/components/admin/ui";
import { adminAction, confirmed, formText, isUuid } from "@/lib/admin/action";
import { auditSink } from "@/lib/admin/audit";
import { switchKeyOff, switchKeyOn } from "@/lib/admin/keys";
import { adminKeyDeps } from "@/lib/admin/server";
import {
  type AdminChangeRequest,
  applyAdminChange,
  cancelSubscription,
  extendTrial,
  type Proration,
  quoteAdminChange,
  setExtraSeats,
  type TrialChoice,
  undoCancellation,
} from "@/lib/admin/subscription-changes";
import {
  adminSubscriptionDeps,
  loadAdminSubscriptionContext,
} from "@/lib/admin/subscription-changes-server";
import { auditedTeamChange, forAdmin } from "@/lib/admin/team";
import type { AppUser } from "@/lib/auth/session";
import { money } from "@/lib/billing/format";
import { rotateKey } from "@/lib/billing/rotate-key";
import { rotateKeyDeps } from "@/lib/billing/rotate-key-server";
import type { ReviewStatus } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  changeRole,
  inviteMember,
  removeMember,
  resendInvite,
  revokeInvite,
  type TeamResult,
} from "@/lib/team/operations";
import { teamDeps } from "@/lib/team/server";

// Admin writes on one organisation (plan §6.8): subscription changes
// (PLAN-09, PLAN-11), API key operations, and team management. Every one
// checks for an admin with MFA first (adminAction) and is audited.

const page = (orgId: string) => `/admin/organisations/${orgId}`;
const validSubscriptionId = (id: string) => /^sub_[A-Za-z0-9]+$/.test(id);

function result(
  r:
    | { ok: true; message: string; warnings?: string[]; warning?: string }
    | { ok: false; error: string },
): ActionState {
  if (!r.ok) return { error: r.error };
  return { message: r.message, warnings: r.warnings ?? (r.warning ? [r.warning] : []) };
}

async function subscriptionContext(orgId: string, subscriptionId: string) {
  if (!isUuid(orgId) || !validSubscriptionId(subscriptionId)) return null;
  return loadAdminSubscriptionContext(orgId, subscriptionId);
}

// --- Change plan (PLAN-09) --------------------------------------------------

export type PlanChangeState = ActionState & {
  quote?: {
    planName: string;
    today: string | null;
    effective: string;
    warnings: string[];
    prorationDate: number;
    nonce: string;
    request: {
      priceId: string;
      trial: TrialChoice;
      trialEnd: string;
      proration: Proration;
      when: "now" | "renewal";
    };
  };
};

const TRIALS: TrialChoice[] = ["keep", "end", "extend"];
const PRORATIONS: Proration[] = ["none", "create_prorations", "always_invoice"];

function readChange(formData: FormData): AdminChangeRequest | string {
  const priceId = formText(formData, "priceId", 100);
  if (!/^price_[A-Za-z0-9]+$/.test(priceId)) return "Choose a price.";
  const trial = formText(formData, "trial") as TrialChoice;
  const proration = formText(formData, "proration") as Proration;
  const when = formText(formData, "when") === "renewal" ? "renewal" : "now";
  if (!TRIALS.includes(trial)) return "Choose what happens to the trial.";
  if (!PRORATIONS.includes(proration)) return "Choose how to prorate.";
  const trialEndText = formText(formData, "trialEnd", 20);
  const trialEnd = trialEndText ? new Date(`${trialEndText}T23:59:00Z`) : null;
  if (trialEnd && Number.isNaN(trialEnd.getTime())) return "Enter a valid trial end date.";
  return { priceId, trial, trialEnd, proration, when };
}

const dateText = (date: Date) =>
  date.toLocaleString("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/London",
  });

export async function previewPlanChange(
  orgId: string,
  subscriptionId: string,
  _state: PlanChangeState,
  formData: FormData,
): Promise<PlanChangeState> {
  let quote: PlanChangeState["quote"];
  const state = await adminAction(page(orgId), async () => {
    const ctx = await subscriptionContext(orgId, subscriptionId);
    if (!ctx) return { error: "Subscription not found." };
    const request = readChange(formData);
    if (typeof request === "string") return { error: request };
    const r = await quoteAdminChange(adminSubscriptionDeps(), ctx, request);
    if (!r.ok) return { error: r.error };
    quote = {
      planName: r.quote.planName,
      today: r.quote.today === null ? null : money(r.quote.today, r.quote.currency),
      effective: dateText(r.quote.effectiveAt),
      warnings: r.quote.warnings,
      prorationDate: r.quote.prorationDate,
      nonce: randomUUID(),
      request: {
        priceId: request.priceId,
        trial: request.trial,
        trialEnd: formText(formData, "trialEnd", 20),
        proration: request.proration,
        when: request.when,
      },
    };
    return {};
  });
  return { ...state, quote };
}

export async function applyPlanChange(
  orgId: string,
  subscriptionId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(page(orgId), async (admin) => {
    const ctx = await subscriptionContext(orgId, subscriptionId);
    if (!ctx) return { error: "Subscription not found." };
    if (!confirmed(formData)) return { error: "Tick the box to confirm." };
    const request = readChange(formData);
    if (typeof request === "string") return { error: request };
    const prorationDate = Number(formText(formData, "prorationDate", 20));
    const nonce = formText(formData, "nonce", 64);
    if (!Number.isInteger(prorationDate) || !isUuid(nonce))
      return { error: "Preview the change again." };
    return result(
      await applyAdminChange(adminSubscriptionDeps(), ctx, request, {
        actorId: admin.id,
        prorationDate,
        nonce,
      }),
    );
  });
}

// --- Seats, trial, cancellation (plan §6.8, PLAN-11) ------------------------

export async function setExtraSeatsAction(
  orgId: string,
  subscriptionId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(page(orgId), async (admin) => {
    const ctx = await subscriptionContext(orgId, subscriptionId);
    if (!ctx) return { error: "Subscription not found." };
    const extraUsers = Number(formText(formData, "extraUsers", 10));
    return result(
      await setExtraSeats(adminSubscriptionDeps(), ctx, {
        actorId: admin.id,
        extraUsers,
        nonce: randomUUID(),
      }),
    );
  });
}

export async function extendTrialAction(
  orgId: string,
  subscriptionId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(page(orgId), async (admin) => {
    const ctx = await subscriptionContext(orgId, subscriptionId);
    if (!ctx) return { error: "Subscription not found." };
    const trialEnd = new Date(`${formText(formData, "trialEnd", 20)}T23:59:00Z`);
    if (Number.isNaN(trialEnd.getTime())) return { error: "Enter the new trial end date." };
    return result(
      await extendTrial(adminSubscriptionDeps(), ctx, {
        actorId: admin.id,
        trialEnd,
        nonce: randomUUID(),
      }),
    );
  });
}

export async function cancelSubscriptionAction(
  orgId: string,
  subscriptionId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(page(orgId), async (admin) => {
    const ctx = await subscriptionContext(orgId, subscriptionId);
    if (!ctx) return { error: "Subscription not found." };
    if (!confirmed(formData)) return { error: "Tick the box to confirm." };
    const when = formText(formData, "when") === "now" ? "now" : "period_end";
    return result(
      await cancelSubscription(adminSubscriptionDeps(), ctx, {
        actorId: admin.id,
        when,
        nonce: randomUUID(),
      }),
    );
  });
}

export async function undoCancellationAction(
  orgId: string,
  subscriptionId: string,
): Promise<ActionState> {
  return adminAction(page(orgId), async (admin) => {
    const ctx = await subscriptionContext(orgId, subscriptionId);
    if (!ctx) return { error: "Subscription not found." };
    return result(await undoCancellation(adminSubscriptionDeps(), ctx, { actorId: admin.id }));
  });
}

// --- API key (plan §6.8, KEY-01) --------------------------------------------

export async function switchKeyOffAction(
  orgId: string,
  keyId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(page(orgId), async (admin) => {
    if (!isUuid(orgId)) return { error: "Not found." };
    if (!confirmed(formData)) return { error: "Tick the box to confirm." };
    return result(
      await switchKeyOff(adminKeyDeps(), {
        orgId,
        keyId,
        actorId: admin.id,
        reason: formText(formData, "reason", 500),
      }),
    );
  });
}

export async function switchKeyOnAction(orgId: string, keyId: string): Promise<ActionState> {
  return adminAction(page(orgId), async (admin) => {
    if (!isUuid(orgId)) return { error: "Not found." };
    return result(await switchKeyOn(adminKeyDeps(), { orgId, keyId, actorId: admin.id }));
  });
}

async function orgSummary(orgId: string) {
  const db = createServiceClient();
  const [{ data: org }, { data: owner }] = await Promise.all([
    db
      .from("organisations")
      .select("id, name, review_status, allow_external_invites")
      .eq("id", orgId)
      .maybeSingle<{
        id: string;
        name: string;
        review_status: ReviewStatus;
        allow_external_invites: boolean;
      }>(),
    db
      .from("memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "owner")
      .maybeSingle<{ user_id: string }>(),
  ]);
  if (!org) return null;
  const { data: profile } = owner
    ? await db
        .from("profiles")
        .select("email")
        .eq("id", owner.user_id)
        .maybeSingle<{ email: string }>()
    : { data: null };
  return { ...org, ownerEmail: profile?.email ?? null };
}

export async function rotateKeyAction(
  orgId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(page(orgId), async (admin) => {
    if (!isUuid(orgId)) return { error: "Not found." };
    if (!confirmed(formData)) return { error: "Tick the box to confirm." };
    const org = await orgSummary(orgId);
    if (!org) return { error: "Organisation not found." };
    const when = formText(formData, "when") === "now" ? "now" : "overlap";
    // record_key_rotation() audits it as key.rotate, by_role admin (KEY-01).
    const r = await rotateKey(
      rotateKeyDeps(),
      {
        id: admin.id,
        email: admin.email,
        role: "admin",
        orgId,
        orgName: org.name,
        reviewStatus: org.review_status,
      },
      when,
    );
    return r.ok
      ? {
          message: r.message
            .replace("Your key", "The key")
            .replace("Your subscription", "The subscription"),
        }
      : { error: r.error.replace("Your subscription", "The subscription") };
  });
}

// --- Team (plan §6.8) -------------------------------------------------------

const adminActor = (admin: AppUser) => ({ id: admin.id, email: admin.email, name: "Mintly" });

async function teamAction(
  orgId: string,
  action: string,
  details: Record<string, unknown>,
  run: (ctx: {
    admin: AppUser;
    org: NonNullable<Awaited<ReturnType<typeof orgSummary>>>;
  }) => Promise<TeamResult>,
): Promise<ActionState> {
  return adminAction(page(orgId), async (admin) => {
    if (!isUuid(orgId)) return { error: "Not found." };
    const org = await orgSummary(orgId);
    if (!org) return { error: "Organisation not found." };
    const r = await auditedTeamChange(
      auditSink(createServiceClient()),
      { actorId: admin.id, orgId, action, details },
      () => run({ admin, org }),
    );
    return result(forAdmin(r));
  });
}

const orgContext = (org: { id: string; name: string; review_status: ReviewStatus }) => ({
  orgId: org.id,
  orgName: org.name,
  reviewStatus: org.review_status,
});

export async function inviteAction(
  orgId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = formText(formData, "email", 254).toLowerCase();
  const role = formText(formData, "role", 20);
  return teamAction(orgId, "team.invite", { email, role }, ({ admin, org }) =>
    inviteMember(teamDeps(), {
      actor: adminActor(admin),
      org: orgContext(org),
      email,
      role,
      ownerEmail: org.ownerEmail,
    }),
  );
}

export async function resendInviteAction(orgId: string, inviteId: string): Promise<ActionState> {
  if (!isUuid(inviteId)) return { error: "Not found." };
  return teamAction(orgId, "team.resend", { invite_id: inviteId }, ({ admin, org }) =>
    resendInvite(teamDeps(), {
      actor: adminActor(admin),
      org: orgContext(org),
      inviteId,
      ownerEmail: org.ownerEmail,
    }),
  );
}

export async function revokeInviteAction(orgId: string, inviteId: string): Promise<ActionState> {
  if (!isUuid(inviteId)) return { error: "Not found." };
  return teamAction(orgId, "team.revoke", { invite_id: inviteId }, ({ org }) =>
    revokeInvite(teamDeps(), { org: orgContext(org), inviteId }),
  );
}

export async function removeMemberAction(
  orgId: string,
  userId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isUuid(userId)) return { error: "Not found." };
  if (!confirmed(formData)) return { error: "Tick the box to confirm." };
  return teamAction(orgId, "team.remove", { user_id: userId }, ({ admin, org }) =>
    removeMember(teamDeps(), { actor: adminActor(admin), org: orgContext(org), userId }),
  );
}

export async function changeRoleAction(
  orgId: string,
  userId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isUuid(userId)) return { error: "Not found." };
  const role = formText(formData, "role", 20);
  return teamAction(orgId, "team.role", { user_id: userId, role }, ({ admin, org }) =>
    changeRole(teamDeps(), { actor: adminActor(admin), org: orgContext(org), userId, role }),
  );
}

export async function transferOwnershipAction(
  orgId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(page(orgId), async (admin) => {
    const userId = formText(formData, "userId", 40);
    if (!isUuid(orgId) || !isUuid(userId)) return { error: "Choose the new owner." };
    if (!confirmed(formData)) return { error: "Tick the box to confirm." };
    // transfer_ownership() audits it in the same transaction (plan §3).
    const { error } = await createServiceClient().rpc("transfer_ownership", {
      p_org_id: orgId,
      p_new_owner_id: userId,
      p_actor_id: admin.id,
    });
    if (error) {
      if (error.code === "P0001")
        return { error: `${error.message[0].toUpperCase()}${error.message.slice(1)}.` };
      throw new Error(error.message);
    }
    return {
      message:
        "Ownership is transferred. The previous owner is now a Developer, so they still see the key.",
    };
  });
}

export async function setExternalInvitesAction(
  orgId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(page(orgId), async (admin) => {
    if (!isUuid(orgId)) return { error: "Not found." };
    const allow = formData.get("allow") === "on";
    const db = createServiceClient();
    const { data, error } = await db
      .from("organisations")
      .update({ allow_external_invites: allow })
      .eq("id", orgId)
      .neq("allow_external_invites", allow)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data.length) return { message: "No change." };
    await auditSink(db)({
      actorId: admin.id,
      orgId,
      action: "team.external_invites",
      before: { allow_external_invites: !allow },
      after: { allow_external_invites: allow },
    });
    return {
      message: allow
        ? "The owner can now invite people from any domain."
        : "Invites are limited to the owner's domain again.",
    };
  });
}
