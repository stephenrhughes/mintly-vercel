import { describe, expect, it, vi } from "vitest";

import { fakeBankResponse } from "./fake";
import { classify, createHttpTransport, send } from "./transport";

describe("classify (TOOL-10, TOOL-12)", () => {
  it.each([
    [200, { Status: "Valid" }, "valid"],
    [200, { Status: "Invalid" }, "invalid"],
    [404, { Message: "Not found" }, "invalid"],
    [400, { Message: "Bad input" }, "invalid"],
    [429, { message: "Limit Exceeded" }, "rate_limited"],
    [403, { message: "Forbidden" }, "error"],
    [500, null, "error"],
  ])("status %p with %j is %p", (status, body, outcome) => {
    expect(classify({ status, body })).toBe(outcome);
  });
});

describe("createHttpTransport", () => {
  it("sends the key in x-api-key and returns the body", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ Status: "Valid" })));
    const transport = createHttpTransport({
      baseUrl: "https://api.test/v1",
      key: "k_secret",
      fetch,
    });
    await expect(transport("/sortcode/424242")).resolves.toEqual({
      status: 200,
      body: { Status: "Valid" },
    });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/v1/sortcode/424242");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k_secret");
  });

  it("keeps a body that isn't JSON as a message", async () => {
    const fetch = vi.fn(async () => new Response("Bad gateway", { status: 502 }));
    const transport = createHttpTransport({ baseUrl: "https://api.test", key: "k", fetch });
    await expect(transport("/x")).resolves.toEqual({
      status: 502,
      body: { Message: "Bad gateway" },
    });
  });
});

describe("send", () => {
  it("turns a network failure into an error outcome", async () => {
    const request = { kind: "sortcode" as const, path: "/sortcode/424242", input: "424242" };
    const result = await send(async () => {
      throw new TypeError("fetch failed");
    }, request);
    expect(result).toEqual({ request, outcome: "error", response: null });
  });
});

describe("the fake API answers like the sandbox", () => {
  it("knows the published test values", () => {
    expect(fakeBankResponse("/sortcode/424242/account/42424242").status).toBe(200);
    expect(fakeBankResponse("/sortcode/424242").status).toBe(200);
    expect(fakeBankResponse("/iban/GB42SAND42424242424242").status).toBe(200);
    expect(fakeBankResponse("/swift/TEST4242XXX").status).toBe(200);
  });

  it("finds nothing else, and rate-limits 99-99-99", () => {
    expect(fakeBankResponse("/sortcode/424242/account/12345678").status).toBe(404);
    expect(fakeBankResponse("/sortcode/123456").status).toBe(404);
    expect(fakeBankResponse("/sortcode/999999").status).toBe(429);
  });
});
