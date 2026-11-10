import { describe, expect, it } from "vitest";

import { memoryAudit } from "./audit";
import {
  type CustomerSetupDeps,
  type SetupInput,
  setUpCustomer,
  validateSetup,
} from "./customer-setup";

const NONCE = "30000000-0000-4000-8000-000000000001";

const input = (overrides: Partial<SetupInput> = {}): SetupInput => ({
  orgName: "Acme Ltd",
  ownerEmail: "Olivia@Acme.co.uk",
  price: { kind: "existing", priceId: "price_eiscd" },
  billing: "invoice",
  daysUntilDue: 30,
  mandateId: null,
  extraUsers: 2,
  trialDays: 0,
  nonce: NONCE,
  ...overrides,
});

function deps(options: { failAt?: string; blocked?: boolean } = {}) {
  const calls: string[] = [];
  const audit = memoryAudit();
  const fail = (step: string) => {
    if (options.failAt === step) throw new Error(`${step} failed`);
  };
  const d: CustomerSetupDeps = {
    isBlockedDomain: async () => options.blocked ?? false,
    existingOrganisationOf: async () => null,
    stripe: {
      getPrice: async (id) => ({ id, product: "eiscd", active: true, recurring: true }),
      createCustomer: async ({ idempotencyKey }) => {
        fail("customer");
        calls.push(`customer ${idempotencyKey}`);
        return "cus_new";
      },
      createCustomPrice: async ({ unitAmount, interval }) => {
        calls.push(`price ${unitAmount}/${interval}`);
        return "price_custom";
      },
      createSubscription: async ({ priceId, billing, metadata }) => {
        fail("subscription");
        calls.push(`subscription ${priceId} ${billing} ${JSON.stringify(metadata)}`);
        return "sub_new";
      },
    },
    createOrganisation: async ({ stripeCustomerId }) => {
      calls.push(`org ${stripeCustomerId}`);
      return "org_new";
    },
    syncSubscription: async (id) => void calls.push(`sync ${id}`),
    inviteOwner: async ({ email }) => {
      calls.push(`invite ${email}`);
      return { ok: true, message: "sent" };
    },
    audit,
  };
  return { deps: d, calls, audit };
}

describe("validateSetup (ADM-12)", () => {
  it("accepts a complete form", () => {
    expect(validateSetup(input())).toBeNull();
  });

  it("needs a trial for card billing, and a mandate only with invoices", () => {
    expect(validateSetup(input({ billing: "card", trialDays: 0 }))).toContain("needs a trial");
    expect(validateSetup(input({ billing: "card", trialDays: 14 }))).toBeNull();
    expect(
      validateSetup(input({ billing: "card", trialDays: 14, mandateId: "MD0001ABCD23EF" })),
    ).toContain("only for invoice");
    expect(validateSetup(input({ mandateId: "nope" }))).toContain("GoCardless");
  });

  it("checks a custom price", () => {
    const custom = {
      kind: "custom" as const,
      basePriceId: "price_base",
      unitAmount: 0,
      interval: "year" as const,
      nickname: "Acme",
    };
    expect(validateSetup(input({ price: custom }))).toContain("more than zero");
    expect(validateSetup(input({ price: { ...custom, unitAmount: 120000 } }))).toBeNull();
  });
});

describe("setUpCustomer (ADM-12, plan §6.7)", () => {
  it("creates the customer, organisation and subscription, provisions the key and invites the owner", async () => {
    const { deps: d, calls, audit } = deps();
    const result = await setUpCustomer(d, input({ mandateId: "MD0001ABCD23EF" }), "admin_1");
    expect(result).toMatchObject({ ok: true, orgId: "org_new" });
    expect(calls).toEqual([
      `customer setup-${NONCE}-customer`,
      "org cus_new",
      'subscription price_eiscd invoice {"createdBy":"admin","orgId":"org_new","extraUsers":"2","mandateId":"MD0001ABCD23EF"}',
      "sync sub_new",
      "invite olivia@acme.co.uk",
    ]);
    // The organisation's creation is audited by create_admin_organisation().
    expect(audit.entries).toEqual([]);
  });

  it("creates a custom price from a base price first", async () => {
    const { deps: d, calls } = deps();
    await setUpCustomer(
      d,
      input({
        price: {
          kind: "custom",
          basePriceId: "price_base",
          unitAmount: 120000,
          interval: "year",
          nickname: "Acme annual",
        },
      }),
      "admin_1",
    );
    expect(calls[0]).toBe("price 120000/year");
    expect(calls[3]).toContain("subscription price_custom");
  });

  it("refuses a blocked domain before touching Stripe", async () => {
    const { deps: d, calls } = deps({ blocked: true });
    expect((await setUpCustomer(d, input(), "admin_1")).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it("stops at a failed step, says which, and audits it", async () => {
    const { deps: d, calls, audit } = deps({ failAt: "subscription" });
    const result = await setUpCustomer(d, input(), "admin_1");
    expect(result).toMatchObject({ ok: false, orgId: "org_new" });
    expect(!result.ok && result.error).toContain("creating the subscription");
    expect(calls).toEqual([`customer setup-${NONCE}-customer`, "org cus_new"]);
    expect(audit.entries[0]).toMatchObject({
      action: "customer.failed",
      orgId: "org_new",
      details: { step: "creating the subscription" },
    });
  });
});
