import { describe, expect, it } from "vitest";

import {
  companyMatchesDomain,
  decideReview,
  mayCheckOut,
  normaliseDomain,
  registrableLabel,
  reviewHasExpired,
  reviewIsOverdue,
  waitingFor,
  workingMinutesBetween,
} from "./rules";

describe("decideReview (APPR-02)", () => {
  const none = { trustedDomain: false, approvedOrgDomain: false, ssoDomain: false };

  it("holds an unknown sign-up for review", () => {
    expect(decideReview(none)).toEqual({ status: "pending_review", reason: "needs_review" });
  });

  it("approves trusted domains, approved organisations' domains and SSO domains, with the reason", () => {
    expect(decideReview({ ...none, trustedDomain: true })).toEqual({
      status: "approved",
      reason: "trusted_domain",
    });
    expect(decideReview({ ...none, approvedOrgDomain: true })).toEqual({
      status: "approved",
      reason: "approved_org_domain",
    });
    expect(decideReview({ ...none, ssoDomain: true })).toEqual({
      status: "approved",
      reason: "sso_domain",
    });
  });
});

describe("mayCheckOut (plan §6.11)", () => {
  it("refuses rejected and suspended organisations", () => {
    expect(mayCheckOut(null)).toBe(true);
    expect(mayCheckOut("approved")).toBe(true);
    expect(mayCheckOut("pending_review")).toBe(true);
    expect(mayCheckOut("rejected")).toBe(false);
    expect(mayCheckOut("suspended")).toBe(false);
  });
});

describe("normaliseDomain", () => {
  it("accepts host names and tidies them", () => {
    expect(normaliseDomain(" @Acme.CO.UK. ")).toBe("acme.co.uk");
    expect(normaliseDomain("not a domain")).toBeNull();
    expect(normaliseDomain("localhost")).toBeNull();
    expect(normaliseDomain("")).toBeNull();
  });
});

describe("registrableLabel", () => {
  it("finds the name part of a domain", () => {
    expect(registrableLabel("acme.com")).toBe("acme");
    expect(registrableLabel("mail.acme.co.uk")).toBe("acme");
    expect(registrableLabel("acme.co.uk")).toBe("acme");
    expect(registrableLabel("leeds.ac.uk")).toBe("leeds");
  });
});

describe("companyMatchesDomain (APPR-04)", () => {
  it.each([
    ["Acme Ltd", "acme.co.uk"],
    ["Acme Widgets Limited", "acmewidgets.com"],
    ["ACME", "acme-widgets.com"],
    ["Smith & Jones LLP", "smithandjones.co.uk"],
    ["International Business Machines", "ibm.com"],
  ])("matches %s and %s", (company, domain) => {
    expect(companyMatchesDomain(company, domain)).toBe(true);
  });

  it.each([
    ["Acme Ltd", "globex.com"],
    ["", "acme.com"],
    [null, "acme.com"],
    ["Ltd", "acme.com"],
  ])("doesn't match %s and %s", (company, domain) => {
    expect(companyMatchesDomain(company, domain)).toBe(false);
  });
});

describe("working time (plan §6.11: reminder after 4 working hours)", () => {
  // 10 November 2026 is a Tuesday; London is on GMT then.
  const at = (iso: string) => new Date(iso);

  it("counts only 9:00 to 17:30 on weekdays, UK time", () => {
    expect(workingMinutesBetween(at("2026-11-10T09:00:00Z"), at("2026-11-10T10:00:00Z"))).toBe(60);
    expect(workingMinutesBetween(at("2026-11-10T17:00:00Z"), at("2026-11-11T10:00:00Z"))).toBe(
      30 + 60,
    );
    // Friday evening to Monday morning: nothing over the weekend.
    expect(workingMinutesBetween(at("2026-11-13T17:30:00Z"), at("2026-11-16T09:00:00Z"))).toBe(0);
  });

  it("uses British Summer Time in summer", () => {
    // 08:00 UTC is 09:00 BST on Wednesday 1 July 2026.
    expect(workingMinutesBetween(at("2026-07-01T08:00:00Z"), at("2026-07-01T09:00:00Z"))).toBe(60);
  });

  it("reminds after 4 working hours, not 4 hours", () => {
    expect(reviewIsOverdue(at("2026-11-10T09:00:00Z"), at("2026-11-10T13:00:00Z"))).toBe(true);
    expect(reviewIsOverdue(at("2026-11-10T09:00:00Z"), at("2026-11-10T12:55:00Z"))).toBe(false);
    // Signed up on Friday at 16:00: due on Monday at 11:30.
    expect(reviewIsOverdue(at("2026-11-13T16:00:00Z"), at("2026-11-16T11:25:00Z"))).toBe(false);
    expect(reviewIsOverdue(at("2026-11-13T16:00:00Z"), at("2026-11-16T11:30:00Z"))).toBe(true);
  });
});

describe("reviewHasExpired (APPR-07)", () => {
  it("expires after 7 days", () => {
    const since = new Date("2026-11-01T12:00:00Z");
    expect(reviewHasExpired(since, new Date("2026-11-08T11:59:00Z"))).toBe(false);
    expect(reviewHasExpired(since, new Date("2026-11-08T12:00:00Z"))).toBe(true);
  });
});

describe("waitingFor", () => {
  it("describes the wait", () => {
    const since = new Date("2026-11-10T09:00:00Z");
    expect(waitingFor(since, new Date("2026-11-10T09:30:00Z"))).toBe("30 minutes");
    expect(waitingFor(since, new Date("2026-11-10T12:00:00Z"))).toBe("3 hours");
    expect(waitingFor(since, new Date("2026-11-13T09:00:00Z"))).toBe("3 days");
  });
});
