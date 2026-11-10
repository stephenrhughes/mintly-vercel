import { describe, expect, it } from "vitest";

// Ported from mintly-web enquiryQualification.test.js (LEAD-01).
import {
  CADENCE,
  CONFIRMS,
  CONSTRAINTS,
  CONTACT,
  EISCD_FORMAT,
  EISCD_USE,
  FAILURES,
  FAILURE_COST,
  INTEGRATION,
  PRODUCT,
  SECTOR,
  VOLUME,
  buildQualification,
  estimateMonthlyFailureCost,
  formatTranscript,
  getOutcome,
  getOutcomeId,
  getSummary,
  getVisibleQuestions,
  isEiscdBranch,
  needsCopExplainer,
  roundDownToTwoSignificantFigures,
  type Answers,
} from "./qualification";

const ids = (answers: Answers) => getVisibleQuestions(answers).map((question) => question.id);

const apiAnswers = (overrides: Answers = {}): Answers => ({
  [PRODUCT]: "api",
  [CONFIRMS]: "details",
  [VOLUME]: "250_10k",
  [CADENCE]: "realtime",
  [INTEGRATION]: "api",
  [FAILURES]: "10_100",
  [FAILURE_COST]: "5_20",
  [CONSTRAINTS]: [],
  [SECTOR]: "payroll",
  ...overrides,
});

describe("branching", () => {
  it("asks the API questions when someone wants to check bank details", () => {
    expect(ids({ [PRODUCT]: "api" })).toEqual([
      PRODUCT,
      CONFIRMS,
      VOLUME,
      CADENCE,
      INTEGRATION,
      FAILURES,
      CONSTRAINTS,
      SECTOR,
      CONTACT,
    ]);
  });

  it("swaps in the licence questions when someone wants the directory itself", () => {
    expect(ids({ [PRODUCT]: "eiscd" })).toEqual([
      PRODUCT,
      EISCD_USE,
      "eiscdFormat",
      "eiscdFrequency",
      "eiscdSites",
      CONSTRAINTS,
      SECTOR,
      CONTACT,
    ]);
  });

  it("keeps the API questions for someone who is not sure yet", () => {
    expect(ids({ [PRODUCT]: "unsure" })).toContain(VOLUME);
    expect(ids({ [PRODUCT]: "unsure" })).not.toContain(EISCD_USE);
  });

  it("picks up the licence questions mid-flow when they ask for the raw file", () => {
    // Asking for the data file at Q5 is a licence conversation, so the rest of
    // the EISCD questions appear from E2 onwards - E1 does not, they have
    // already told us what they're doing.
    const visible = ids(apiAnswers({ [INTEGRATION]: "file" }));

    expect(visible).toContain(EISCD_FORMAT);
    expect(visible).not.toContain(EISCD_USE);
    expect(visible).not.toContain(FAILURES);
  });

  it("skips the cost question when there are no failures to cost", () => {
    expect(ids(apiAnswers({ [FAILURES]: "none" }))).not.toContain(FAILURE_COST);
    expect(ids(apiAnswers({ [FAILURES]: "unknown" }))).not.toContain(FAILURE_COST);
    expect(ids(apiAnswers({ [FAILURES]: "10_100" }))).toContain(FAILURE_COST);
  });

  it("treats both routes into the licence questions as the EISCD branch", () => {
    expect(isEiscdBranch({ [PRODUCT]: "eiscd" })).toBe(true);
    expect(isEiscdBranch({ [PRODUCT]: "api", [INTEGRATION]: "file" })).toBe(true);
    expect(isEiscdBranch({ [PRODUCT]: "api" })).toBe(false);
  });
});

describe("Confirmation of Payee screen", () => {
  it("explains itself to anyone who needs name matching", () => {
    expect(needsCopExplainer({ [CONFIRMS]: "name" })).toBe(true);
    expect(needsCopExplainer({ [CONFIRMS]: "both" })).toBe(true);
  });

  it("stays out of the way of everyone else", () => {
    expect(needsCopExplainer({ [CONFIRMS]: "details" })).toBe(false);
    expect(needsCopExplainer({})).toBe(false);
  });
});

describe("cost of failed payments", () => {
  it("multiplies the two bands by their midpoints", () => {
    // 50 failures a month at £12 each.
    expect(estimateMonthlyFailureCost(apiAnswers())).toBe(600);
  });

  it("rounds down to two significant figures so it never overstates", () => {
    expect(roundDownToTwoSignificantFigures(12800)).toBe(12000);
    expect(roundDownToTwoSignificantFigures(97500)).toBe(97000);
    expect(roundDownToTwoSignificantFigures(15)).toBe(15);
    expect(roundDownToTwoSignificantFigures(0)).toBe(0);
  });

  it("gives no figure when either band is missing", () => {
    expect(estimateMonthlyFailureCost(apiAnswers({ [FAILURES]: "unknown" }))).toBeNull();
    expect(estimateMonthlyFailureCost(apiAnswers({ [FAILURE_COST]: "unknown" }))).toBeNull();
    expect(estimateMonthlyFailureCost({})).toBeNull();
  });

  it("gives no figure on the licence branch, where per-check maths does not apply", () => {
    expect(estimateMonthlyFailureCost(apiAnswers({ [INTEGRATION]: "file" }))).toBeNull();
  });
});

describe("routing", () => {
  it("sends the licence branch to an EISCD call", () => {
    expect(getOutcome({ [PRODUCT]: "eiscd" })).toMatchObject({
      type: "call",
      meeting: "eiscd",
    });
  });

  it("sends anyone who must keep the data in-house to an EISCD call", () => {
    // They asked about the API, but on-premise data is a licence, not a plan.
    const outcome = getOutcome(apiAnswers({ [CONSTRAINTS]: ["onprem"] }));

    expect(outcome).toMatchObject({ type: "call", meeting: "eiscd" });
  });

  it.each([
    ["security", "a security review or a DPA"],
    ["procurement", "procurement"],
    ["throughput", "1,000 checks a minute"],
  ])("books a call when %s rules out a self-serve signup", (constraint, reason) => {
    const outcome = getOutcome(apiAnswers({ [CONSTRAINTS]: [constraint] }));

    expect(outcome).toMatchObject({ type: "call", meeting: "api" });
    expect(outcome.reasons.join(" ")).toContain(reason);
  });

  it("books a call above 25,000 checks a month", () => {
    expect(getOutcome(apiAnswers({ [VOLUME]: "25k_50k" })).type).toBe("call");
    expect(getOutcome(apiAnswers({ [VOLUME]: "50k_plus" })).type).toBe("call");
  });

  it("falls back to a plain enquiry when they don't know their volume", () => {
    expect(getOutcome(apiAnswers({ [VOLUME]: "unknown" })).type).toBe("enquiry");
  });

  it.each([
    ["lt250", "starter"],
    ["250_10k", "standardPlus"],
    ["10k_25k", "professional"],
  ])("recommends a plan at %s", (volume, plan) => {
    expect(getOutcome(apiAnswers({ [VOLUME]: volume }))).toMatchObject({
      type: "plan",
      plan,
    });
  });

  it("lets a hard constraint override an otherwise self-serve volume", () => {
    // 250-10k would be Standard Plus, but nobody buys through procurement with
    // a card on a trial signup.
    const outcome = getOutcome(apiAnswers({ [VOLUME]: "250_10k", [CONSTRAINTS]: ["procurement"] }));

    expect(outcome.type).toBe("call");
  });

  it("ignores constraints that are merely useful to know", () => {
    expect(getOutcome(apiAnswers({ [CONSTRAINTS]: ["teams", "none"] })).type).toBe("plan");
  });

  it("names the ending for analytics", () => {
    expect(getOutcomeId({ type: "plan", plan: "starter", reasons: [] })).toBe("trial_starter");
    expect(getOutcomeId({ type: "call", meeting: "eiscd", reasons: [] })).toBe("call_eiscd");
    expect(getOutcomeId({ type: "enquiry", reasons: [] })).toBe("enquiry");
  });
});

describe("summary", () => {
  it("leads with the plan, the volume and the sector", () => {
    expect(getSummary(apiAnswers())).toBe("Standard Plus Plan, 250–10k checks/mo, payroll bureau");
  });

  it("says so when it is a licence enquiry", () => {
    expect(getSummary({ [PRODUCT]: "eiscd", [SECTOR]: "lender" })).toBe(
      "EISCD licence, lender or broker",
    );
  });
});

describe("transcript", () => {
  const contact = {
    email: "alex@example.com",
    company: "Example Ltd",
    phone: " 01234 567890 ",
    notes: "We run payroll for 400 clients",
  };

  it("writes every visible question out with its answer", () => {
    const transcript = formatTranscript(apiAnswers(), contact);

    expect(transcript).toContain("Roughly how many checks would you need each month?");
    expect(transcript).toContain("250 to 10,000");
    expect(transcript).toContain("Example Ltd");
    expect(transcript).toContain("Telephone: 01234 567890");
    expect(transcript).toContain("We run payroll for 400 clients");
  });

  it("includes the estimated cost so it is in the email too", () => {
    expect(formatTranscript(apiAnswers(), contact)).toContain("£600 per month");
  });

  it("leaves out questions the person never saw", () => {
    const transcript = formatTranscript({ [PRODUCT]: "eiscd" }, contact);

    expect(transcript).not.toContain("Roughly how many checks");
  });

  it("omits the telephone line entirely when no phone number is given", () => {
    // The old form carried "Telephone: undefined" into the inbox.
    const transcript = formatTranscript(apiAnswers(), { email: "a@b.com" });

    expect(transcript).not.toMatch(/Telephone/);
    expect(transcript).not.toMatch(/undefined/);
  });

  it("ignores a whitespace-only phone number", () => {
    const transcript = formatTranscript(apiAnswers(), { phone: "   " });

    expect(transcript).not.toMatch(/Telephone/);
  });
});

describe("structured payload", () => {
  it("records the visible answers, the outcome and where they started", () => {
    const qualification = buildQualification(
      apiAnswers(),
      { company: "Example Ltd", phone: "01234", notes: "" },
      "/pricing",
    );

    expect(qualification).toMatchObject({
      [PRODUCT]: "api",
      [VOLUME]: "250_10k",
      estimatedMonthlyCost: 600,
      company: "Example Ltd",
      phone: "01234",
      notes: null,
      outcome: "trial_standardPlus",
      sourcePage: "/pricing",
    });
  });

  it("drops answers from a branch they left behind", () => {
    // Someone who starts on the API path and switches to the data file should
    // not have stale volume answers reported as though they still applied.
    const qualification: Record<string, unknown> = buildQualification(
      apiAnswers({ [PRODUCT]: "eiscd" }),
      {},
    );

    expect(qualification[VOLUME]).toBeUndefined();
    expect(qualification[EISCD_FORMAT]).toBeNull();
  });
});
