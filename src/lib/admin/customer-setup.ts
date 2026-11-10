// Set up a customer (ADM-12, plan §6.7, §6.8): an admin creates an
// organisation for any product (EISCD included) on any price, including a
// new custom one, billed by card or invoice (optionally with a GoCardless
// mandate), with extra seats and an optional trial, then invites its owner.
// These organisations are approved straight away.
//
// Each step is idempotent on the form's nonce, so a failed set-up can be
// retried from the same form without making a second customer, price or
// subscription. Success and failure are both audited.

import { z } from "zod";

import type { Product } from "@/lib/billing/subscription-record";
import type { TeamResult } from "@/lib/team/operations";

import { type AuditSink, errorText } from "./audit";

export type PriceChoice =
  | { kind: "existing"; priceId: string }
  | {
      kind: "custom";
      basePriceId: string;
      /** In pence. */
      unitAmount: number;
      interval: "month" | "year";
      nickname: string;
    };

export type SetupInput = {
  orgName: string;
  ownerEmail: string;
  price: PriceChoice;
  billing: "card" | "invoice";
  daysUntilDue: number;
  mandateId: string | null;
  extraUsers: number;
  trialDays: number;
  nonce: string;
};

export type SetupPrice = { id: string; product: Product; active: boolean; recurring: boolean };

export type CustomerSetupDeps = {
  isBlockedDomain(domain: string): Promise<boolean>;
  /** The organisation the owner's email already belongs to, if any. */
  existingOrganisationOf(email: string): Promise<string | null>;
  stripe: {
    getPrice(id: string): Promise<SetupPrice | null>;
    createCustomer(input: { name: string; email: string; idempotencyKey: string }): Promise<string>;
    createCustomPrice(input: {
      basePriceId: string;
      unitAmount: number;
      interval: "month" | "year";
      nickname: string;
      idempotencyKey: string;
    }): Promise<string>;
    createSubscription(input: {
      customerId: string;
      priceId: string;
      billing: "card" | "invoice";
      daysUntilDue: number;
      trialDays: number;
      metadata: Record<string, string>;
      idempotencyKey: string;
    }): Promise<string>;
  };
  createOrganisation(input: {
    name: string;
    stripeCustomerId: string;
    actorId: string;
    details: Record<string, unknown>;
  }): Promise<string>;
  syncSubscription(subscriptionId: string): Promise<void>;
  inviteOwner(input: { orgId: string; orgName: string; email: string }): Promise<TeamResult>;
  audit: AuditSink;
};

export type SetupResult =
  | { ok: true; orgId: string; message: string; warnings: string[] }
  | { ok: false; error: string; orgId?: string };

const MANDATE = /^MD[0-9A-Z]{6,30}$/;

const inputSchema = z
  .object({
    orgName: z.string().trim().min(1, "Enter the organisation's name.").max(200),
    ownerEmail: z.email("Enter the owner's email address.").max(254),
    billing: z.enum(["card", "invoice"]),
    daysUntilDue: z
      .number()
      .int()
      .min(1, "Invoices are due 1 to 90 days after they're sent.")
      .max(90, "Invoices are due 1 to 90 days after they're sent."),
    mandateId: z
      .string()
      .regex(MANDATE, "A GoCardless mandate ID looks like MD0001ABCD23EF.")
      .nullable(),
    extraUsers: z
      .number()
      .int()
      .min(0, "Extra seats must be 0 to 1000.")
      .max(1000, "Extra seats must be 0 to 1000."),
    trialDays: z
      .number()
      .int()
      .min(0, "A trial is 0 to 730 days.")
      .max(730, "A trial is 0 to 730 days."),
    nonce: z.uuid(),
  })
  .refine((v) => v.billing === "invoice" || v.trialDays > 0, {
    message:
      "Card billing needs a trial: the owner adds a card from Change plan before it ends. Otherwise bill by invoice.",
  })
  .refine((v) => v.billing === "invoice" || !v.mandateId, {
    message: "A GoCardless mandate is only for invoice billing.",
  });

/** Checks the set-up form (ADM-12). */
export function validateSetup(input: SetupInput): string | null {
  const result = inputSchema.safeParse(input);
  if (!result.success) return result.error.issues[0]?.message ?? "Check the form.";
  if (input.price.kind === "existing" && !/^price_[A-Za-z0-9]+$/.test(input.price.priceId)) {
    return "Choose a price.";
  }
  if (input.price.kind === "custom") {
    if (!/^price_[A-Za-z0-9]+$/.test(input.price.basePriceId)) {
      return "Choose the price the custom one is based on.";
    }
    if (!Number.isInteger(input.price.unitAmount) || input.price.unitAmount <= 0) {
      return "Enter the custom price in pounds, more than zero.";
    }
    if (!input.price.nickname.trim()) return 'Name the custom price, for example "Acme annual".';
  }
  return null;
}

export async function setUpCustomer(
  deps: CustomerSetupDeps,
  input: SetupInput,
  actorId: string,
): Promise<SetupResult> {
  const invalid = validateSetup(input);
  if (invalid) return { ok: false, error: invalid };

  const email = input.ownerEmail.trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  if (await deps.isBlockedDomain(domain)) {
    return {
      ok: false,
      error: `${domain} is a blocked domain. Remove it from the blocked list first.`,
    };
  }
  const warnings: string[] = [];
  const existing = await deps.existingOrganisationOf(email);
  if (existing) {
    warnings.push(
      `${email} already belongs to ${existing}. They'll be asked to confirm moving when they accept; an owner of another organisation can't move until that's sorted out.`,
    );
  }

  const key = (step: string) => `setup-${input.nonce}-${step}`;
  const details: Record<string, unknown> = {
    owner_email: email,
    billing: input.billing,
    trial_days: input.trialDays,
    extra_users: input.extraUsers,
    mandate: Boolean(input.mandateId),
    price: input.price,
  };
  let step = "checking the price";
  let orgId: string | undefined;
  try {
    let priceId: string;
    if (input.price.kind === "custom") {
      const base = await deps.stripe.getPrice(input.price.basePriceId);
      if (!base) return { ok: false, error: "The base price doesn't exist." };
      step = "creating the custom price";
      priceId = await deps.stripe.createCustomPrice({
        basePriceId: base.id,
        unitAmount: input.price.unitAmount,
        interval: input.price.interval,
        nickname: input.price.nickname.trim(),
        idempotencyKey: key("price"),
      });
    } else {
      const price = await deps.stripe.getPrice(input.price.priceId);
      if (!price || !price.recurring) return { ok: false, error: "Choose a recurring price." };
      if (!price.active) warnings.push("That price is inactive (legacy).");
      priceId = price.id;
    }
    details.price_id = priceId;

    step = "creating the Stripe customer";
    const customerId = await deps.stripe.createCustomer({
      name: input.orgName.trim(),
      email,
      idempotencyKey: key("customer"),
    });

    step = "creating the organisation";
    orgId = await deps.createOrganisation({
      name: input.orgName.trim(),
      stripeCustomerId: customerId,
      actorId,
      details,
    });

    step = "creating the subscription";
    const metadata: Record<string, string> = { createdBy: "admin", orgId };
    if (input.extraUsers) metadata.extraUsers = String(input.extraUsers);
    // BILL-04: GoCardless collects send-invoice invoices against this mandate (phase 7).
    if (input.mandateId) metadata.mandateId = input.mandateId;
    const subscriptionId = await deps.stripe.createSubscription({
      customerId,
      priceId,
      billing: input.billing,
      daysUntilDue: input.daysUntilDue,
      trialDays: input.trialDays,
      metadata,
      idempotencyKey: key("subscription"),
    });
    details.stripe_subscription_id = subscriptionId;

    step = "provisioning the API key";
    await deps.syncSubscription(subscriptionId);

    step = "inviting the owner";
    const invite = await deps.inviteOwner({ orgId, orgName: input.orgName.trim(), email });
    if (!invite.ok) {
      // A retry finds the invite already sent; anything else is worth saying.
      if (!invite.error.includes("already has an invite"))
        warnings.push(`Owner invite: ${invite.error}`);
    } else if (invite.warning) {
      warnings.push(invite.warning);
    }
  } catch (error) {
    await deps
      .audit({
        actorId,
        orgId: orgId ?? null,
        action: "customer.failed",
        details: { ...details, step, error: errorText(error) },
      })
      .catch((e) => console.error("auditing the failed set-up failed", e));
    return {
      ok: false,
      orgId,
      error: `Set-up stopped while ${step}: ${errorText(error).replace(/\.+$/, "")}. Submit the form again to carry on from there.`,
    };
  }

  return {
    ok: true,
    orgId,
    message: `${input.orgName.trim()} is set up and ${email} is invited as its owner.`,
    warnings,
  };
}
