import { describe, expect, it } from "vitest";

import { siteRoute } from "@/lib/marketing/routes";

import { docsPathFor, EISCD_SPECS, findSpec, resolveCombo } from "./specs";

describe("EISCD spec matrix (DOC-02)", () => {
  it("serves the default combination from /eiscd-docs", () => {
    expect(docsPathFor("weekly", "v2")).toBe("/eiscd-docs");
    expect(docsPathFor("weekly", "v1")).toBe("/eiscd-docs/weekly/v1");
  });

  it("keeps the weekly v1 download URL customers already fetch", () => {
    expect(findSpec("weekly", "v1")?.slug).toBe("eiscd-openapi");
  });

  it("falls back to the newest version for a frequency without the one asked for", () => {
    expect(resolveCombo("monthly", "v1")?.version).toBe("v2");
  });

  it("registers a page for every spec", () => {
    for (const spec of EISCD_SPECS) expect(() => siteRoute(spec.path)).not.toThrow();
  });
});

describe("the spec list the build scripts use", () => {
  it("covers exactly the specs the docs pages render", async () => {
    const { OPENAPI_SPECS } = await import("../../../scripts/openapi-specs.mjs");
    const { BANK_CHECKER_SPEC } = await import("./specs");
    expect([...OPENAPI_SPECS].sort()).toEqual([BANK_CHECKER_SPEC.slug, ...EISCD_SPECS.map((s) => s.slug)].sort());
  });
});
