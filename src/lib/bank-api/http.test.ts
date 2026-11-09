import { describe, expect, it } from "vitest";

import { batchSchema, parseSingle, requestProblem, singleCheckSchema } from "./http";

const post = (headers: Record<string, string>) =>
  new Request("https://app.mintly.uk/api/check", { method: "POST", headers });

describe("requestProblem (cross-site protection)", () => {
  it("accepts same-origin JSON", () => {
    expect(
      requestProblem(
        post({
          "content-type": "application/json",
          origin: "https://app.mintly.uk",
          host: "app.mintly.uk",
        }),
      ),
    ).toBeNull();
  });

  it("refuses other content types, other origins and a missing origin", () => {
    expect(
      requestProblem(
        post({
          "content-type": "text/plain",
          origin: "https://app.mintly.uk",
          host: "app.mintly.uk",
        }),
      ),
    ).toMatchObject({ status: 415 });
    expect(
      requestProblem(
        post({
          "content-type": "application/json",
          origin: "https://evil.test",
          host: "app.mintly.uk",
        }),
      ),
    ).toMatchObject({ status: 403 });
    expect(
      requestProblem(post({ "content-type": "application/json", host: "app.mintly.uk" })),
    ).toMatchObject({ status: 403 });
  });
});

describe("request bodies", () => {
  it("parses a single check", () => {
    const check = singleCheckSchema.parse({ kind: "account", sortCode: "424242" });
    expect(parseSingle(check)).toMatchObject({ ok: true, request: { kind: "sortcode" } });
  });

  it("limits a batch to 25 lines", () => {
    const lines = (n: number) => Array.from({ length: n }, () => "424242");
    expect(batchSchema.safeParse({ dataType: "sortcode", lines: lines(25) }).success).toBe(true);
    expect(batchSchema.safeParse({ dataType: "sortcode", lines: lines(26) }).success).toBe(false);
    expect(batchSchema.safeParse({ dataType: "other", lines: lines(1) }).success).toBe(false);
  });
});
