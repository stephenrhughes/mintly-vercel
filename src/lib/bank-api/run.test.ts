import { describe, expect, it, vi } from "vitest";

import { createFakeTransport } from "./fake";
import { sortCodeRequest } from "./requests";
import { parseBatch, runChecks } from "./run";
import { createHttpTransport } from "./transport";

const KEY = "k3y_value_that_must_never_leave_the_server";

describe("runChecks (plan §6.2)", () => {
  it("never returns the key, though it sends it upstream (Q2)", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["x-api-key"]).toBe(KEY);
      return new Response(
        JSON.stringify({ Status: "Valid", DerivedIban: "GB42SAND42424242424242" }),
      );
    });
    const transport = createHttpTransport({
      baseUrl: "https://api.test",
      key: KEY,
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    const results = await runChecks(
      { transport, log: async () => {}, sleep: async () => {} },
      { pacingMs: 20 },
      parseBatch(
        Array.from({ length: 25 }, () => "424242,42424242"),
        "standard",
      ),
    );
    expect(results).toHaveLength(25);
    expect(fetch).toHaveBeenCalledTimes(25);
    expect(JSON.stringify(results)).not.toContain(KEY);
  });

  it("paces calls to the plan's throttle (TOOL-09)", async () => {
    const sleep = vi.fn(async () => {});
    await runChecks(
      { transport: createFakeTransport(), log: async () => {}, sleep },
      { pacingMs: 500 },
      parseBatch(["424242", "424242", "424242"], "sortcode"),
    );
    expect(sleep.mock.calls).toEqual([[500], [500]]);
  });

  it("reports malformed lines without sending or logging them (TOOL-08)", async () => {
    const log = vi.fn(async () => {});
    const results = await runChecks(
      { transport: createFakeTransport(), log, sleep: async () => {} },
      { pacingMs: 0 },
      parseBatch(["424242,42424242", "not a line"], "standard"),
    );
    expect(results.map((r) => r.outcome)).toEqual(["valid", "malformed"]);
    expect(results[1].message).toMatch(/comma/);
    expect(log).toHaveBeenCalledWith([{ kind: "account", outcome: "valid" }]);
  });

  it("stops at the first rate limit and marks the rest not sent (TOOL-12)", async () => {
    const transport = vi.fn(createFakeTransport());
    const results = await runChecks(
      { transport, log: async () => {}, sleep: async () => {} },
      { pacingMs: 0 },
      parseBatch(["424242", "999999", "424242", "bad"], "sortcode"),
    );
    expect(results.map((r) => r.outcome)).toEqual([
      "valid",
      "rate_limited",
      "not_sent",
      "malformed",
    ]);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("logs kind and outcome only: no bank details (plan §4)", async () => {
    const log = vi.fn(async () => {});
    await runChecks(
      { transport: createFakeTransport(), log, sleep: async () => {} },
      { pacingMs: 0 },
      [{ input: "123456,12345678", parsed: sortCodeRequest("123456", "12345678") }],
    );
    expect(log).toHaveBeenCalledWith([{ kind: "account", outcome: "invalid" }]);
    expect(JSON.stringify(log.mock.calls)).not.toContain("12345678");
  });

  it("still answers when the log can't be written", async () => {
    const results = await runChecks(
      {
        transport: createFakeTransport(),
        log: async () => {
          throw new Error("db down");
        },
      },
      { pacingMs: 0 },
      parseBatch(["424242"], "sortcode"),
    );
    expect(results[0].outcome).toBe("valid");
  });
});
