import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ProvisioningBusyError } from "@/lib/billing/provision";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import type { ReviewStatus } from "@/lib/nav";

import { normaliseDomain } from "./rules";

// The admin's review decisions (plan §6.11, APPR-05 to APPR-08). The status
// change and its audit entry happen together in apply_review_decision(),
// which also refuses a decision the current status doesn't allow. Stripe,
// the API key and email are handled around it, in an order that leaves
// nothing half done that can't be retried.

export type ReviewAction = "approve" | "ask_info" | "decline" | "expire" | "suspend" | "reinstate";

export type ReviewNotifier = {
  approved(to: string, input: { orgName: string; trialEnd: Date | null }): Promise<void>;
  infoRequest(to: string, input: { orgName: string; message: string }): Promise<void>;
  declined(to: string, input: { orgName: string }): Promise<void>;
  expired(to: string, input: { orgName: string }): Promise<void>;
  addToMarketingList(email: string): Promise<void>;
};

export type ReviewDeps = {
  /** Supabase with the service role. Callers have already checked the admin. */
  db: SupabaseClient;
  stripe: {
    setTrialEnd(subscriptionId: string, trialEnd: Date): Promise<void>;
    cancel(subscriptionId: string, comment: string): Promise<void>;
  };
  /** Re-syncs a subscription, which creates, enables or disables the key. */
  syncSubscription(subscriptionId: string): Promise<void>;
  notify: ReviewNotifier;
  now?: () => Date;
};

export type ReviewResult =
  { ok: true; message: string; warnings: string[] } | { ok: false; error: string };

export const DECLINE_COMMENT = "Declined in trial review";

type Context = {
  orgId: string;
  orgName: string;
  status: ReviewStatus;
  domain: string | null;
  owner: { email: string; marketingOptOut: boolean } | null;
  subscription: { id: string; trialing: boolean } | null;
};

async function loadContext(db: SupabaseClient, orgId: string): Promise<Context | null> {
  const org = await db
    .from("organisations")
    .select("id, name, review_status, signup_signals")
    .eq("id", orgId)
    .maybeSingle<{
      id: string;
      name: string;
      review_status: ReviewStatus;
      signup_signals: { domain?: string } | null;
    }>();
  if (org.error) throw new Error(`reading the organisation failed: ${org.error.message}`);
  if (!org.data) return null;

  const [ownerRow, sub] = await Promise.all([
    db
      .from("memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "owner")
      .maybeSingle<{ user_id: string }>(),
    db
      .from("subscriptions")
      .select("stripe_subscription_id, trialing")
      .eq("org_id", orgId)
      .eq("product", "bank_checker")
      .eq("expired", false)
      .maybeSingle<{ stripe_subscription_id: string; trialing: boolean }>(),
  ]);
  if (ownerRow.error) throw new Error(`reading the owner failed: ${ownerRow.error.message}`);
  if (sub.error) throw new Error(`reading the subscription failed: ${sub.error.message}`);

  let owner: Context["owner"] = null;
  if (ownerRow.data) {
    const profile = await db
      .from("profiles")
      .select("email, marketing_opt_out")
      .eq("id", ownerRow.data.user_id)
      .maybeSingle<{ email: string; marketing_opt_out: boolean }>();
    if (profile.data) {
      owner = { email: profile.data.email, marketingOptOut: profile.data.marketing_opt_out };
    }
  }

  return {
    orgId,
    orgName: org.data.name,
    status: org.data.review_status,
    domain:
      normaliseDomain(org.data.signup_signals?.domain) ??
      normaliseDomain(owner?.email.split("@").pop()),
    owner,
    subscription: sub.data
      ? { id: sub.data.stripe_subscription_id, trialing: sub.data.trialing }
      : null,
  };
}

class InvalidTransitionError extends Error {}

async function transition(
  db: SupabaseClient,
  input: {
    orgId: string;
    actorId: string | null;
    action: ReviewAction;
    note?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<ReviewStatus> {
  const { data, error } = await db.rpc("apply_review_decision", {
    p_org_id: input.orgId,
    p_actor_id: input.actorId,
    p_action: input.action,
    p_note: input.note ?? null,
    p_details: input.details ?? {},
  });
  if (error) {
    if (error.code === "P0001") throw new InvalidTransitionError(error.message);
    throw new Error(`recording the decision failed: ${error.message}`);
  }
  return data as ReviewStatus;
}

const alreadyDecided: ReviewResult = {
  ok: false,
  error: "This review has already been decided. Refresh the page to see its status.",
};

async function attempt(warnings: string[], what: string, task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    console.error(`${what} failed`, error);
    warnings.push(`${what} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function syncKey(deps: ReviewDeps, ctx: Context, warnings: string[]) {
  if (!ctx.subscription) return;
  try {
    await deps.syncSubscription(ctx.subscription.id);
  } catch (error) {
    if (error instanceof ProvisioningBusyError) {
      // A Stripe event is being handled at the same moment; it reads the
      // new status and does the same thing.
      return;
    }
    console.error("syncing the key after a review decision failed", error);
    warnings.push(
      "The API key couldn't be updated just now. It will be when Stripe next sends an event for this subscription, or resync it.",
    );
  }
}

/** Adds a domain to the trusted or blocked list, audited (APPR-05). */
export async function addDomain(
  db: SupabaseClient,
  input: {
    list: "trusted" | "blocked";
    domain: string;
    reason: string | null;
    actorId: string;
    orgId?: string;
  },
): Promise<void> {
  const domain = normaliseDomain(input.domain);
  if (!domain) throw new Error(`"${input.domain}" isn't a domain`);
  const table = input.list === "trusted" ? "trusted_domains" : "blocked_domains";
  const { data, error } = await db
    .from(table)
    .upsert(
      { domain, reason: input.reason, added_by: input.actorId },
      { onConflict: "domain", ignoreDuplicates: true },
    )
    .select("domain");
  if (error) throw new Error(`adding ${domain} failed: ${error.message}`);
  if (data.length === 0) return; // Already listed.
  await audit(db, {
    actorId: input.actorId,
    orgId: input.orgId ?? null,
    action: input.list === "trusted" ? "domain.trust" : "domain.block",
    details: { domain, reason: input.reason },
  });
}

export async function removeDomain(
  db: SupabaseClient,
  input: { list: "trusted" | "blocked"; domain: string; actorId: string },
): Promise<void> {
  const table = input.list === "trusted" ? "trusted_domains" : "blocked_domains";
  const { data, error } = await db.from(table).delete().eq("domain", input.domain).select("domain");
  if (error) throw new Error(`removing ${input.domain} failed: ${error.message}`);
  if (data.length === 0) return;
  await audit(db, {
    actorId: input.actorId,
    orgId: null,
    action: input.list === "trusted" ? "domain.untrust" : "domain.unblock",
    details: { domain: input.domain },
  });
}

async function audit(
  db: SupabaseClient,
  input: {
    actorId: string | null;
    orgId: string | null;
    action: string;
    details: Record<string, unknown>;
  },
) {
  const { error } = await db.from("admin_audit").insert({
    actor_id: input.actorId,
    target_org_id: input.orgId,
    action: input.action,
    details: input.details,
  });
  if (error) throw new Error(`writing the audit entry failed: ${error.message}`);
}

/**
 * Approve: the key is created in the trial usage plan, and the trial is
 * reset to start now, so time spent waiting isn't lost (APPR-06).
 */
export async function approve(
  deps: ReviewDeps,
  input: { orgId: string; actorId: string; trustDomain: boolean },
): Promise<ReviewResult> {
  const ctx = await loadContext(deps.db, input.orgId);
  if (!ctx) return { ok: false, error: "Organisation not found." };
  if (ctx.status !== "pending_review") return alreadyDecided;

  const now = deps.now?.() ?? new Date();
  const warnings: string[] = [];

  // Stripe first: if it fails, nothing has changed and the admin can retry.
  let trialEnd: Date | null = null;
  if (ctx.subscription?.trialing) {
    trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    try {
      await deps.stripe.setTrialEnd(ctx.subscription.id, trialEnd);
    } catch (error) {
      console.error("resetting the trial failed", error);
      return {
        ok: false,
        error: `We couldn't restart the trial in Stripe, so nothing has changed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  try {
    await transition(deps.db, {
      orgId: ctx.orgId,
      actorId: input.actorId,
      action: "approve",
      details: {
        trial_end: trialEnd?.toISOString() ?? null,
        trusted_domain: input.trustDomain ? ctx.domain : null,
      },
    });
  } catch (error) {
    if (error instanceof InvalidTransitionError) return alreadyDecided;
    throw error;
  }

  if (input.trustDomain && ctx.domain) {
    const domain = ctx.domain;
    await attempt(warnings, `Trusting ${domain}`, () =>
      addDomain(deps.db, {
        list: "trusted",
        domain,
        reason: `Approved ${ctx.orgName}`,
        actorId: input.actorId,
        orgId: ctx.orgId,
      }),
    );
  }

  await syncKey(deps, ctx, warnings);

  const owner = ctx.owner;
  if (owner) {
    await attempt(warnings, "Emailing the owner", () =>
      deps.notify.approved(owner.email, { orgName: ctx.orgName, trialEnd }),
    );
    // PROV-02: held back until approval.
    if (!owner.marketingOptOut) {
      await attempt(warnings, "Adding the owner to Brevo", () =>
        deps.notify.addToMarketingList(owner.email),
      );
    }
  }
  return { ok: true, message: `${ctx.orgName} is approved.`, warnings };
}

/** Ask for information: the review stays pending, the request is recorded and emailed. */
export async function askForInformation(
  deps: ReviewDeps,
  input: { orgId: string; actorId: string; message: string },
): Promise<ReviewResult> {
  const message = input.message.trim();
  if (message.length < 10) return { ok: false, error: "Write the question to send to the owner." };

  const ctx = await loadContext(deps.db, input.orgId);
  if (!ctx) return { ok: false, error: "Organisation not found." };
  if (!ctx.owner) return { ok: false, error: "This organisation has no owner to email." };

  try {
    await transition(deps.db, {
      orgId: ctx.orgId,
      actorId: input.actorId,
      action: "ask_info",
      note: message,
    });
  } catch (error) {
    if (error instanceof InvalidTransitionError) return alreadyDecided;
    throw error;
  }

  const owner = ctx.owner;
  const warnings: string[] = [];
  await attempt(warnings, "Emailing the owner", () =>
    deps.notify.infoRequest(owner.email, { orgName: ctx.orgName, message }),
  );
  return { ok: true, message: `We've asked ${owner.email} for more information.`, warnings };
}

/**
 * Decline (or expire): the status changes first, so a concurrent approval
 * can't win, then the Stripe trial is cancelled with no charge (APPR-07).
 * If the cancellation fails, declining again retries it.
 */
async function endReview(
  deps: ReviewDeps,
  input: {
    orgId: string;
    actorId: string | null;
    action: "decline" | "expire";
    blockDomain: boolean;
  },
): Promise<ReviewResult> {
  const ctx = await loadContext(deps.db, input.orgId);
  if (!ctx) return { ok: false, error: "Organisation not found." };

  let decided = false;
  if (ctx.status === "pending_review") {
    try {
      await transition(deps.db, {
        orgId: ctx.orgId,
        actorId: input.actorId,
        action: input.action,
        details: { blocked_domain: input.blockDomain ? ctx.domain : null },
      });
      decided = true;
    } catch (error) {
      if (!(error instanceof InvalidTransitionError)) throw error;
    }
  }
  if (!decided) {
    // Only a retry of a decline that couldn't cancel Stripe gets past here.
    const fresh = await loadContext(deps.db, input.orgId);
    if (fresh?.status !== "rejected" || !fresh.subscription) return alreadyDecided;
  }

  const warnings: string[] = [];
  if (ctx.subscription) {
    try {
      await deps.stripe.cancel(ctx.subscription.id, DECLINE_COMMENT);
    } catch (error) {
      console.error("cancelling the declined trial failed", error);
      return {
        ok: false,
        error: `The organisation is declined, but cancelling its Stripe subscription failed. Decline again to retry. (${error instanceof Error ? error.message : String(error)})`,
      };
    }
  }

  if (input.blockDomain && ctx.domain && input.actorId) {
    const domain = ctx.domain;
    const actorId = input.actorId;
    await attempt(warnings, `Blocking ${domain}`, () =>
      addDomain(deps.db, {
        list: "blocked",
        domain,
        reason: `Declined ${ctx.orgName}`,
        actorId,
        orgId: ctx.orgId,
      }),
    );
  }

  const owner = ctx.owner;
  if (decided && owner) {
    await attempt(warnings, "Emailing the owner", () =>
      input.action === "decline"
        ? deps.notify.declined(owner.email, { orgName: ctx.orgName })
        : deps.notify.expired(owner.email, { orgName: ctx.orgName }),
    );
  }
  return {
    ok: true,
    message:
      input.action === "decline"
        ? `${ctx.orgName} is declined.`
        : `${ctx.orgName}'s review expired.`,
    warnings,
  };
}

export function decline(
  deps: ReviewDeps,
  input: { orgId: string; actorId: string; blockDomain: boolean },
): Promise<ReviewResult> {
  return endReview(deps, { ...input, action: "decline" });
}

/** The system declines a review that has waited 7 days (APPR-07). */
export function expire(deps: ReviewDeps, input: { orgId: string }): Promise<ReviewResult> {
  return endReview(deps, {
    orgId: input.orgId,
    actorId: null,
    action: "expire",
    blockDomain: false,
  });
}

/** Suspend an approved organisation found abusing the service: the key is disabled (APPR-08). */
export async function suspend(
  deps: ReviewDeps,
  input: { orgId: string; actorId: string; reason: string },
): Promise<ReviewResult> {
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "Say why the organisation is being suspended." };
  return changeAccess(deps, { ...input, action: "suspend", note: reason });
}

/** Reinstate a suspended organisation: the key is turned back on. */
export function reinstate(
  deps: ReviewDeps,
  input: { orgId: string; actorId: string },
): Promise<ReviewResult> {
  return changeAccess(deps, { ...input, action: "reinstate", note: null });
}

async function changeAccess(
  deps: ReviewDeps,
  input: { orgId: string; actorId: string; action: "suspend" | "reinstate"; note: string | null },
): Promise<ReviewResult> {
  const ctx = await loadContext(deps.db, input.orgId);
  if (!ctx) return { ok: false, error: "Organisation not found." };
  try {
    await transition(deps.db, {
      orgId: ctx.orgId,
      actorId: input.actorId,
      action: input.action,
      note: input.note,
    });
  } catch (error) {
    if (error instanceof InvalidTransitionError) return alreadyDecided;
    throw error;
  }
  const warnings: string[] = [];
  await syncKey(deps, ctx, warnings);
  return {
    ok: true,
    message:
      input.action === "suspend"
        ? `${ctx.orgName} is suspended and its key is off.`
        : `${ctx.orgName} is reinstated and its key is back on.`,
    warnings,
  };
}
