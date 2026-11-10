import { describe, expect, it, vi } from "vitest";

import { createFakeTransport } from "@/lib/bank-api/fake";
import type { BankTransport } from "@/lib/bank-api/transport";

import { type FreeCheckDeps, runFreeCheck } from "./check";

const deps = (over: Partial<FreeCheckDeps> = {}): FreeCheckDeps => ({
  verifyCaptcha: async () => ({ ok: true, skipped: false }),
  take: async () => ({ result: "ok", used: 1 }),
  transport: async () => createFakeTransport(),
  ...over,
});

describe("free checker (FREE-01 to FREE-03, FREE-05)", () => {
  it("answers VALID with the bank name only", async () => {
    const result = await runFreeCheck({ sortCode: "42-42-42", accountNumber: "42424242" }, deps());
    expect(result).toEqual({
      status: 200,
      body: { status: "VALID", bank: "MINTLY TEST BANK", used: 1 },
    });
    expect(JSON.stringify(result.body)).not.toMatch(/Branch|Address|Bic|Payment/i);
  });

  it("answers INVALID for an unknown sort code", async () => {
    const result = await runFreeCheck({ sortCode: "000000" }, deps());
    expect(result).toEqual({ status: 200, body: { status: "INVALID", used: 1 } });
  });

  it("validates input before spending a check or a captcha call", async () => {
    const take = vi.fn();
    const verifyCaptcha = vi.fn();
    const result = await runFreeCheck({ sortCode: "12-34" }, deps({ take, verifyCaptcha }));
    expect(result.status).toBe(400);
    expect(take).not.toHaveBeenCalled();
    expect(verifyCaptcha).not.toHaveBeenCalled();
  });

  it("refuses a failed captcha without counting a check (FREE-02)", async () => {
    const take = vi.fn();
    const result = await runFreeCheck(
      { sortCode: "424242" },
      deps({ verifyCaptcha: async () => ({ ok: false, reason: "rejected" }), take }),
    );
    expect(result).toEqual({ status: 401, body: { error: "captcha" } });
    expect(take).not.toHaveBeenCalled();
  });

  it("says when the week's checks are used up (FREE-03)", async () => {
    const transport = vi.fn();
    const result = await runFreeCheck(
      { sortCode: "424242" },
      deps({ take: async () => ({ result: "weekly_limit", used: 10 }), transport }),
    );
    expect(result).toEqual({ status: 429, body: { error: "weekly_limit", used: 10 } });
    expect(transport).not.toHaveBeenCalled();
  });

  it("asks a too-quick second check to wait, rather than locking the visitor out", async () => {
    const result = await runFreeCheck(
      { sortCode: "424242" },
      deps({ take: async () => ({ result: "too_fast", used: 3 }) }),
    );
    expect(result).toEqual({ status: 429, body: { error: "too_fast", retryAfter: 2 } });
  });

  it("reports the service as unavailable, not the details as invalid, when the API fails", async () => {
    const failing: BankTransport = async () => ({ status: 403, body: { Message: "Forbidden" } });
    expect(
      (await runFreeCheck({ sortCode: "424242" }, deps({ transport: async () => failing }))).status,
    ).toBe(503);
    const throwing: BankTransport = async () => {
      throw new Error("timeout");
    };
    expect(
      (await runFreeCheck({ sortCode: "424242" }, deps({ transport: async () => throwing })))
        .status,
    ).toBe(503);
    expect(
      (
        await runFreeCheck(
          { sortCode: "424242" },
          deps({ take: async () => Promise.reject(new Error("db")) }),
        )
      ).status,
    ).toBe(503);
  });
});
