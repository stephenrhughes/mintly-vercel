// Offers (ADM-11, OFF-01, plan §4): a bespoke price for an organisation,
// or for an email address before it has one. Admins create, list and
// withdraw them here; customers accept them in phase 7. Every create and
// withdrawal is audited.

import { z } from "zod";

import { type AuditSink, errorText } from "./audit";

export type OfferStatus = "pending" | "accepted" | "expired" | "revoked";

export type OfferRow = {
  id: string;
  orgId: string | null;
  email: string | null;
  stripePriceId: string;
  headline: string;
  message: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export function offerStatus(
  offer: Pick<OfferRow, "acceptedAt" | "revokedAt" | "expiresAt">,
  now: Date,
): OfferStatus {
  if (offer.acceptedAt) return "accepted";
  if (offer.revokedAt) return "revoked";
  if (offer.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

export type OfferInput = {
  target: { orgId: string } | { email: string };
  price:
    | { kind: "existing"; priceId: string }
    | {
        kind: "custom";
        basePriceId: string;
        unitAmount: number;
        interval: "month" | "year";
        nickname: string;
      };
  headline: string;
  message: string;
  expiresAt: Date;
  nonce: string;
};

const DAY = 24 * 60 * 60 * 1000;

const schema = z.object({
  headline: z.string().trim().min(1, "Write a headline for the offer.").max(200),
  message: z.string().trim().max(2000, "Keep the message under 2,000 characters."),
  nonce: z.uuid(),
});

export function validateOffer(input: OfferInput, now: Date): string | null {
  const result = schema.safeParse(input);
  if (!result.success) return result.error.issues[0]?.message ?? "Check the form.";
  if ("email" in input.target) {
    if (!z.email().safeParse(input.target.email.trim()).success)
      return "Enter a valid email address.";
  } else if (!z.uuid().safeParse(input.target.orgId).success) {
    return "Choose the organisation.";
  }
  if (Number.isNaN(input.expiresAt.getTime()) || input.expiresAt.getTime() <= now.getTime()) {
    return "Choose an expiry date in the future.";
  }
  if (input.expiresAt.getTime() > now.getTime() + 366 * DAY) {
    return "An offer can last at most a year.";
  }
  if (input.price.kind === "existing" && !/^price_[A-Za-z0-9]+$/.test(input.price.priceId)) {
    return "Choose a price.";
  }
  if (input.price.kind === "custom") {
    if (!Number.isInteger(input.price.unitAmount) || input.price.unitAmount <= 0) {
      return "Enter the custom price in pounds, more than zero.";
    }
    if (!input.price.nickname.trim()) return "Name the custom price.";
  }
  return null;
}

export type OfferDeps = {
  orgExists(orgId: string): Promise<boolean>;
  priceExists(priceId: string): Promise<boolean>;
  createCustomPrice(input: {
    basePriceId: string;
    unitAmount: number;
    interval: "month" | "year";
    nickname: string;
    idempotencyKey: string;
  }): Promise<string>;
  insert(
    row: Omit<OfferRow, "id" | "acceptedAt" | "revokedAt" | "createdAt"> & { createdBy: string },
  ): Promise<string>;
  get(offerId: string): Promise<OfferRow | null>;
  revoke(offerId: string): Promise<boolean>;
  audit: AuditSink;
  now?: () => Date;
};

export type OfferResult = { ok: true; message: string } | { ok: false; error: string };

export async function createOffer(
  deps: OfferDeps,
  input: OfferInput,
  actorId: string,
): Promise<OfferResult> {
  const now = deps.now?.() ?? new Date();
  const invalid = validateOffer(input, now);
  if (invalid) return { ok: false, error: invalid };
  const orgId = "orgId" in input.target ? input.target.orgId : null;
  const email = "email" in input.target ? input.target.email.trim().toLowerCase() : null;
  if (orgId && !(await deps.orgExists(orgId)))
    return { ok: false, error: "Organisation not found." };

  let priceId: string;
  try {
    if (input.price.kind === "custom") {
      if (!(await deps.priceExists(input.price.basePriceId))) {
        return { ok: false, error: "The base price doesn't exist." };
      }
      priceId = await deps.createCustomPrice({
        basePriceId: input.price.basePriceId,
        unitAmount: input.price.unitAmount,
        interval: input.price.interval,
        nickname: input.price.nickname.trim(),
        idempotencyKey: `offer-${input.nonce}-price`,
      });
    } else {
      if (!(await deps.priceExists(input.price.priceId)))
        return { ok: false, error: "That price doesn't exist." };
      priceId = input.price.priceId;
    }
  } catch (error) {
    return { ok: false, error: `Stripe refused the price: ${errorText(error)}` };
  }

  const id = await deps.insert({
    orgId,
    email,
    stripePriceId: priceId,
    headline: input.headline.trim(),
    message: input.message.trim() || null,
    expiresAt: input.expiresAt,
    createdBy: actorId,
  });
  await deps.audit({
    actorId,
    orgId,
    action: "offer.create",
    after: {
      offer_id: id,
      stripe_price_id: priceId,
      email,
      expires_at: input.expiresAt.toISOString(),
    },
    details: { headline: input.headline.trim() },
  });
  return {
    ok: true,
    message: `Offer made${email ? ` to ${email}` : ""}. Customers accept offers from phase 7.`,
  };
}

export async function revokeOffer(
  deps: OfferDeps,
  input: { offerId: string; actorId: string },
): Promise<OfferResult> {
  const offer = await deps.get(input.offerId);
  if (!offer) return { ok: false, error: "Offer not found." };
  const status = offerStatus(offer, deps.now?.() ?? new Date());
  if (status !== "pending") return { ok: false, error: `That offer is already ${status}.` };
  if (!(await deps.revoke(offer.id))) return { ok: false, error: "That offer is no longer open." };
  await deps.audit({
    actorId: input.actorId,
    orgId: offer.orgId,
    action: "offer.revoke",
    before: { offer_id: offer.id, stripe_price_id: offer.stripePriceId, email: offer.email },
  });
  return { ok: true, message: "The offer is withdrawn." };
}
