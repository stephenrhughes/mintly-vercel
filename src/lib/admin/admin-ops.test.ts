import { describe, expect, it } from "vitest";

import { memoryAudit } from "./audit";
import { type AdminKey, type AdminKeyDeps, switchKeyOff, switchKeyOn } from "./keys";
import {
  parseSsoDomain,
  removeSsoDomain,
  saveSsoDomain,
  type SsoDeps,
  type SsoDomain,
  supabaseProjectRef,
} from "./sso";
import { auditedTeamChange, forAdmin } from "./team";

const ORG = "10000000-0000-4000-8000-00000000000a";

function keyDeps(key: AdminKey | null, fail = false) {
  const calls: string[] = [];
  const audit = memoryAudit();
  const deps: AdminKeyDeps = {
    getKey: async () => key,
    switchOffInAws: async (id) => {
      if (fail) throw new Error("AWS down");
      calls.push(`off ${id}`);
    },
    saveKey: async (id, state) => void calls.push(`save ${id} ${JSON.stringify(state)}`),
    syncSubscription: async (id) => void calls.push(`sync ${id}`),
    audit,
  };
  return { deps, calls, audit };
}

const key = (overrides: Partial<AdminKey> = {}): AdminKey => ({
  id: "key_1",
  orgId: ORG,
  enabled: true,
  usagePlanId: "plan_paid",
  disabledByAdmin: false,
  subscriptionId: "sub_1",
  ...overrides,
});

describe("admin key switch (plan §6.8)", () => {
  it("switches a key off for good, with a reason, audited", async () => {
    const { deps, calls, audit } = keyDeps(key());
    const result = await switchKeyOff(deps, {
      orgId: ORG,
      keyId: "key_1",
      actorId: "a",
      reason: "Leaked on GitHub",
    });
    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      "off key_1",
      'save key_1 {"enabled":false,"usagePlanId":null,"disabledByAdmin":true}',
    ]);
    expect(audit.entries[0]).toMatchObject({
      action: "key.disable",
      details: { reason: "Leaked on GitHub" },
    });
  });

  it("needs a reason, and the key must belong to the organisation", async () => {
    expect(
      (
        await switchKeyOff(keyDeps(key()).deps, {
          orgId: ORG,
          keyId: "key_1",
          actorId: "a",
          reason: " ",
        })
      ).ok,
    ).toBe(false);
    const other = keyDeps(key({ orgId: "other" }));
    expect(
      (await switchKeyOff(other.deps, { orgId: ORG, keyId: "key_1", actorId: "a", reason: "x" }))
        .ok,
    ).toBe(false);
    expect(other.audit.entries).toEqual([]);
  });

  it("audits a failure in API Gateway", async () => {
    const { deps, calls, audit } = keyDeps(key(), true);
    const result = await switchKeyOff(deps, {
      orgId: ORG,
      keyId: "key_1",
      actorId: "a",
      reason: "x",
    });
    expect(result.ok).toBe(false);
    expect(calls).toEqual([]);
    expect(audit.entries[0].action).toBe("key.failed");
  });

  it("switches back on by handing the key back to the subscription's rules", async () => {
    const { deps, calls, audit } = keyDeps(
      key({ enabled: false, usagePlanId: null, disabledByAdmin: true }),
    );
    const result = await switchKeyOn(deps, { orgId: ORG, keyId: "key_1", actorId: "a" });
    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      'save key_1 {"enabled":false,"usagePlanId":null,"disabledByAdmin":false}',
      "sync sub_1",
    ]);
    expect(audit.entries[0].action).toBe("key.enable");
  });
});

describe("auditedTeamChange (plan §6.8)", () => {
  const entry = {
    actorId: "a",
    orgId: ORG,
    action: "team.invite",
    details: { email: "x@acme.co.uk" },
  };

  it("audits a change that happened", async () => {
    const audit = memoryAudit();
    await auditedTeamChange(audit, entry, async () => ({ ok: true, message: "Invite sent." }));
    expect(audit.entries).toEqual([expect.objectContaining({ action: "team.invite" })]);
  });

  it("doesn't audit a refusal or a no-op", async () => {
    const audit = memoryAudit();
    await auditedTeamChange(audit, entry, async () => ({ ok: false, error: "Team full" }));
    await auditedTeamChange(audit, entry, async () => ({ ok: true, message: "No change." }));
    expect(audit.entries).toEqual([]);
  });

  it("audits an unexpected failure, then rethrows it", async () => {
    const audit = memoryAudit();
    await expect(
      auditedTeamChange(audit, entry, async () => {
        throw new Error("db down");
      }),
    ).rejects.toThrow("db down");
    expect(audit.entries[0]).toMatchObject({
      action: "team.failed",
      details: { change: "team.invite" },
    });
  });

  it("rewords owner-facing errors for admins", () => {
    expect(
      forAdmin({
        ok: false,
        error: "The owner can't be changed here. Contact us to transfer ownership.",
      }),
    ).toEqual({ ok: false, error: "Transfer ownership to someone else first." });
    expect(
      forAdmin({
        ok: false,
        error:
          "Your team is full (3 of 2 seats used). Remove a member or withdraw an invite, or contact us to add seats.",
      }),
    ).toEqual({
      ok: false,
      error:
        "The team is full (3 of 2 seats used). Add extra seats on the subscription, or withdraw an invite, first.",
    });
  });
});

describe("SSO domains (SSO-07)", () => {
  const PROVIDER = "20000000-0000-4000-8000-000000000001";
  const row: SsoDomain = {
    domain: "acme.co.uk",
    orgId: ORG,
    providerId: PROVIDER,
    defaultRole: "member",
    enabled: true,
  };

  function ssoDeps(existing: SsoDomain | null) {
    const audit = memoryAudit();
    const saved: SsoDomain[] = [];
    const deps: SsoDeps = {
      get: async () => existing,
      orgExists: async (id) => id === ORG,
      save: async (r) => void saved.push(r),
      remove: async () => undefined,
      audit,
    };
    return { deps, audit, saved };
  }

  it("checks the form", () => {
    expect(
      parseSsoDomain({
        domain: " ACME.co.uk ",
        orgId: ORG,
        providerId: PROVIDER,
        defaultRole: "member",
        enabled: true,
      }),
    ).toEqual({ ok: true, value: row });
    expect(
      parseSsoDomain({
        domain: "acme",
        orgId: ORG,
        providerId: PROVIDER,
        defaultRole: "member",
        enabled: true,
      }).ok,
    ).toBe(false);
    expect(
      parseSsoDomain({
        domain: "acme.co.uk",
        orgId: ORG,
        providerId: "nope",
        defaultRole: "member",
        enabled: true,
      }).ok,
    ).toBe(false);
    expect(
      parseSsoDomain({
        domain: "acme.co.uk",
        orgId: ORG,
        providerId: PROVIDER,
        defaultRole: "owner",
        enabled: true,
      }).ok,
    ).toBe(false);
  });

  it("adds, updates and removes a domain, audited", async () => {
    const add = ssoDeps(null);
    expect((await saveSsoDomain(add.deps, { row, actorId: "a", isNew: true })).ok).toBe(true);
    expect(add.audit.entries[0]).toMatchObject({ action: "sso.add", before: null });

    const update = ssoDeps(row);
    expect(
      (
        await saveSsoDomain(update.deps, {
          row: { ...row, enabled: false },
          actorId: "a",
          isNew: false,
        })
      ).ok,
    ).toBe(true);
    expect(update.audit.entries[0]).toMatchObject({
      action: "sso.update",
      after: { enabled: false },
    });

    expect((await removeSsoDomain(update.deps, { domain: "acme.co.uk", actorId: "a" })).ok).toBe(
      true,
    );
    expect(update.audit.entries[1].action).toBe("sso.remove");
  });

  it("refuses a duplicate or an unknown organisation", async () => {
    const dup = ssoDeps(row);
    expect((await saveSsoDomain(dup.deps, { row, actorId: "a", isNew: true })).ok).toBe(false);
    const noOrg = ssoDeps(null);
    expect(
      (
        await saveSsoDomain(noOrg.deps, {
          row: { ...row, orgId: "20000000-0000-4000-8000-000000000009" },
          actorId: "a",
          isNew: true,
        })
      ).ok,
    ).toBe(false);
    expect([...dup.audit.entries, ...noOrg.audit.entries]).toEqual([]);
  });

  it("reads the project ref from the Supabase URL", () => {
    expect(supabaseProjectRef("https://abcd1234.supabase.co")).toBe("abcd1234");
    expect(supabaseProjectRef("http://127.0.0.1:54321")).toBeNull();
  });
});
