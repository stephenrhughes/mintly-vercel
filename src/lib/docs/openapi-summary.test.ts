import { describe, expect, it } from "vitest";

import swagger from "../../../public/assets/swagger.json";

import { slugify, summariseSpec } from "./openapi-summary";

describe("OpenAPI summary for the docs fallback (DOC-01)", () => {
  it("uses ReDoc's slug rules", () => {
    expect(slugify("Sort Code & Account Validation")).toBe("Sort-Code-and-Account-Validation");
    expect(slugify("  AI agent skill ")).toBe("AI-agent-skill");
  });

  it("lists every operation in the Bank Account Checker spec with a ReDoc anchor", () => {
    const summary = summariseSpec(swagger as Parameters<typeof summariseSpec>[0]);
    expect(summary.title).toBe("Mintly Bank Account Checker API");
    expect(summary.operations.length).toBeGreaterThan(3);
    for (const op of summary.operations) expect(op.anchor).toMatch(/^#(tag|operation)\//);
  });

  it("splits the description into sections at top-level headings, ignoring code fences", () => {
    const summary = summariseSpec({
      info: { description: "Intro.\n\n# First\nBody\n```\n# not a heading\n```\n## Second\nMore" },
    });
    expect(summary.descriptionHtml).toContain("Intro.");
    expect(summary.sections.map((s) => s.title)).toEqual(["First", "Second"]);
    expect(summary.sections[0].id).toBe("section/First");
  });
});
