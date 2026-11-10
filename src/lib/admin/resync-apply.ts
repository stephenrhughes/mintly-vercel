// Carrying out a resync (ADM-05, ADM-07). The preview and the apply both
// re-read Stripe and API Gateway; apply refuses when the stored record has
// changed since the preview, runs the key actions first, stops on the first
// failure before the record is touched, and records the outcome either way.

import type { SubscriptionRecord } from "@/lib/billing/subscription-record";
import type { ReviewStatus } from "@/lib/nav";

import { type AuditSink, errorText } from "./audit";
import type { StoredSubscriptionRow } from "./drift";
import {
  type AwsKeyState,
  blockerText,
  describeKeyAction,
  planResync,
  type ResyncPlan,
  type StoredKey,
} from "./resync";

export type ResyncContext = {
  orgId: string;
  orgName: string;
  orgStripeCustomerId: string | null;
  reviewStatus: ReviewStatus;
  stored: StoredSubscriptionRow | null;
  key: StoredKey | null;
};

export type ResyncDeps = {
  load(orgId: string, subscriptionId: string): Promise<ResyncContext | null>;
  /** Stripe's current record, or null when Stripe has no such subscription. */
  retrieveLive(subscriptionId: string): Promise<SubscriptionRecord | null>;
  awsKey(keyId: string): Promise<AwsKeyState>;
  keys: {
    addToPlan(keyId: string, usagePlanId: string): Promise<void>;
    removeFromPlan(keyId: string, usagePlanId: string): Promise<void>;
    setEnabled(keyId: string, enabled: boolean): Promise<void>;
  };
  saveKeyRow(keyId: string, state: { enabled: boolean; usagePlanId: string | null }): Promise<void>;
  /** Provisioning's own sync, which writes the subscription row from Stripe. */
  syncSubscription(subscriptionId: string): Promise<void>;
  audit: AuditSink;
};

export type ResyncPreview =
  | { ok: true; orgName: string; plan: ResyncPlan; blockerMessages: string[] }
  | { ok: false; error: string };

async function plan(
  deps: ResyncDeps,
  orgId: string,
  subscriptionId: string,
): Promise<{ ctx: ResyncContext; plan: ResyncPlan } | null> {
  const ctx = await deps.load(orgId, subscriptionId);
  if (!ctx) return null;
  const [live, aws] = await Promise.all([
    deps.retrieveLive(subscriptionId),
    ctx.key ? deps.awsKey(ctx.key.id) : Promise.resolve(null),
  ]);
  return {
    ctx,
    plan: planResync({
      orgStripeCustomerId: ctx.orgStripeCustomerId,
      reviewStatus: ctx.reviewStatus,
      stored: ctx.stored,
      live,
      key: ctx.key,
      aws,
    }),
  };
}

export async function previewResync(
  deps: ResyncDeps,
  input: { orgId: string; subscriptionId: string },
): Promise<ResyncPreview> {
  const planned = await plan(deps, input.orgId, input.subscriptionId);
  if (!planned) return { ok: false, error: "Organisation not found." };
  return {
    ok: true,
    orgName: planned.ctx.orgName,
    plan: planned.plan,
    blockerMessages: planned.plan.blockers.map((b) => blockerText[b]),
  };
}

export type ResyncResult = { ok: true; message: string } | { ok: false; error: string };

export async function applyResync(
  deps: ResyncDeps,
  input: { orgId: string; subscriptionId: string; fingerprint: string; actorId: string },
): Promise<ResyncResult> {
  const planned = await plan(deps, input.orgId, input.subscriptionId);
  if (!planned) return { ok: false, error: "Organisation not found." };
  const { ctx, plan: p } = planned;

  if (p.fingerprint !== input.fingerprint) {
    return {
      ok: false,
      error: "The stored record has changed since the preview. Preview the resync again.",
    };
  }
  if (p.blockers.length) {
    return { ok: false, error: p.blockers.map((b) => blockerText[b]).join(" ") };
  }

  const details = {
    stripe_subscription_id: input.subscriptionId,
    changes: p.changes,
    key_actions: p.keyActions,
  };
  const done: string[] = [];
  try {
    for (const action of p.keyActions) {
      switch (action.type) {
        case "add_to_plan":
          await deps.keys.addToPlan(action.keyId, action.usagePlanId);
          break;
        case "remove_from_plan":
          await deps.keys.removeFromPlan(action.keyId, action.usagePlanId);
          break;
        case "enable":
          await deps.keys.setEnabled(action.keyId, true);
          break;
        case "disable":
          await deps.keys.setEnabled(action.keyId, false);
          break;
      }
      done.push(describeKeyAction(action));
    }
    if (ctx.key && p.keyTarget) {
      await deps.saveKeyRow(ctx.key.id, {
        enabled: p.keyTarget.enabled,
        usagePlanId: p.keyTarget.plans[0] ?? null,
      });
    }
    await deps.syncSubscription(input.subscriptionId);
  } catch (error) {
    await deps.audit({
      actorId: input.actorId,
      orgId: ctx.orgId,
      action: "resync.failed",
      details: { ...details, completed: done, error: errorText(error) },
    });
    return {
      ok: false,
      error: `The resync stopped: ${errorText(error)}.${done.length ? ` Done before it stopped: ${done.join("; ")}.` : " Nothing was changed."}`,
    };
  }

  await deps.audit({
    actorId: input.actorId,
    orgId: ctx.orgId,
    action: "resync.apply",
    details,
  });
  const count = p.changes.length + p.keyActions.length;
  return {
    ok: true,
    message:
      count === 0
        ? `${ctx.orgName} was already in line with Stripe.`
        : `${ctx.orgName} is back in line with Stripe (${count} ${count === 1 ? "change" : "changes"}).`,
  };
}
