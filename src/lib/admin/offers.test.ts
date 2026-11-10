import { describe, expect, it } from "vitest";

import { memoryAudit } from "./audit";
import {
  createOffer,
  type OfferDeps,
  type OfferInput,
  type OfferRow,
  offerStatus,
  revokeOffer,
} from "./offers";

const NOW = new Date("2026-06-01T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ORG = "10000000-0000-4000-8000-00000000000a";

const input = (overrides: Partial<OfferInput> = {}): OfferInput => ({
  target: { orgId: ORG },
  price: { kind: "existing", priceId: "price_offer" },
  headline: "20% off for a year",
  message: "As discussed.",
  expiresAt: new Date(NOW.getTime() + 14 * DAY),
  nonce: "30000000-0000-4000-8000-000000000001",
  ...overrides,
});

function deps(existing: OfferRow | null = null) {
  const audit = memoryAudit();
  const inserted: unknown[] = [];
  const d: OfferDeps = {
    orgExists: async (id) => id === ORG,
    priceExists: async (id) => id.startsWith("price_"),
    createCustomPrice: async () => "price_custom",
    insert: async (row) => {
      inserted.push(row);
      return "offer_1";
    },
    get: async () => existing,
    revoke: async () => true,
    audit,
    now: () => NOW,
  };
  return { deps: d, audit, inserted };
}

const row = (overrides: Partial<OfferRow> = {}): OfferRow => ({
  id: "offer_1",
  orgId: ORG,
  email: null,
  stripePriceId: "price_offer",
  headline: "h",
  message: null,
  expiresAt: new Date(NOW.getTime() + DAY),
  acceptedAt: null,
  revokedAt: null,
  createdAt: NOW,
  ...overrides,
});

describe("offerStatus (ADM-11)", () => {
  it("is pending, accepted, revoked or expired", () => {
    expect(offerStatus(row(), NOW)).toBe("pending");
    expect(offerStatus(row({ acceptedAt: NOW }), NOW)).toBe("accepted");
    expect(offerStatus(row({ revokedAt: NOW }), NOW)).toBe("revoked");
    expect(offerStatus(row({ expiresAt: NOW }), NOW)).toBe("expired");
  });
});

describe("createOffer and revokeOffer (ADM-11)", () => {
  it("creates an offer for an organisation, audited", async () => {
    const { deps: d, audit, inserted } = deps();
    expect((await createOffer(d, input(), "admin_1")).ok).toBe(true);
    expect(inserted[0]).toMatchObject({ orgId: ORG, email: null, stripePriceId: "price_offer" });
    expect(audit.entries[0]).toMatchObject({ action: "offer.create", orgId: ORG });
  });

  it("creates a custom price for an email address", async () => {
    const { deps: d, inserted } = deps();
    const result = await createOffer(
      d,
      input({
        target: { email: "Lead@Initech.co.uk" },
        price: {
          kind: "custom",
          basePriceId: "price_base",
          unitAmount: 9900,
          interval: "month",
          nickname: "Initech",
        },
      }),
      "admin_1",
    );
    expect(result.ok).toBe(true);
    expect(inserted[0]).toMatchObject({
      orgId: null,
      email: "lead@initech.co.uk",
      stripePriceId: "price_custom",
    });
  });

  it("refuses a past expiry, an unknown organisation or an empty headline", async () => {
    const { deps: d, audit } = deps();
    expect((await createOffer(d, input({ expiresAt: NOW }), "a")).ok).toBe(false);
    expect(
      (
        await createOffer(
          d,
          input({ target: { orgId: "20000000-0000-4000-8000-000000000009" } }),
          "a",
        )
      ).ok,
    ).toBe(false);
    expect((await createOffer(d, input({ headline: " " }), "a")).ok).toBe(false);
    expect(audit.entries).toEqual([]);
  });

  it("withdraws a pending offer, audited, but not an accepted one", async () => {
    const pending = deps(row());
    expect((await revokeOffer(pending.deps, { offerId: "offer_1", actorId: "a" })).ok).toBe(true);
    expect(pending.audit.entries[0].action).toBe("offer.revoke");
    const accepted = deps(row({ acceptedAt: NOW }));
    expect((await revokeOffer(accepted.deps, { offerId: "offer_1", actorId: "a" })).ok).toBe(false);
  });
});
