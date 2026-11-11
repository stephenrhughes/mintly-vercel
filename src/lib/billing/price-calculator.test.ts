import { describe, expect, it } from "vitest";

import { recommendPlan } from "./change-plan";
import { PLANS } from "./plans";
import {
  buildQuote,
  CALCULATOR_TIERS,
  costForTier,
  formatMoney,
  formatPence,
  MAX_REQUESTS,
  MAX_SLIDER_REQUESTS,
  MIN_REQUESTS,
  requestsToSlider,
  sanitiseRequests,
  sanitiseSeats,
  SLIDER_STEPS,
  sliderToRequests,
} from "./price-calculator";

// Ported from mintly-web priceCalculator.test.js (WEB-05).
const tier = (key: string) => CALCULATOR_TIERS.find((t) => t.key === key)!;
const recommend = (input: Parameters<typeof buildQuote>[0]) => buildQuote(input).recommended!.key;
const rowFor = (quote: ReturnType<typeof buildQuote>, key: string) =>
  quote.tiers.find((row) => row.key === key)!;

describe("formatting", () => {
  it("shows pence only when there are pence", () => {
    expect(formatMoney(37)).toBe("£37");
    expect(formatMoney(2130)).toBe("£2,130");
    expect(formatMoney(172.41666666)).toBe("£172.42");
  });

  it("renders a dash rather than NaN for an absent price", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatPence(null)).toBe("—");
  });

  it("rounds pence instead of showing float noise", () => {
    expect(formatPence(0.8999999999999999)).toBe("0.9p");
    expect(formatPence(0.44)).toBe("0.44p");
    expect(formatPence(1.2)).toBe("1.2p");
  });
});

describe("input sanitising", () => {
  it("floors, clamps and rejects rubbish", () => {
    expect(sanitiseRequests("1200.7")).toBe(1200);
    expect(sanitiseRequests(-5)).toBe(0);
    expect(sanitiseRequests("abc")).toBe(0);
    expect(sanitiseRequests(MAX_REQUESTS * 10)).toBe(MAX_REQUESTS);
  });

  it("keeps the team at one seat or more", () => {
    expect(sanitiseSeats(0)).toBe(1);
    expect(sanitiseSeats("")).toBe(1);
    expect(sanitiseSeats("4")).toBe(4);
  });
});

describe("slider mapping", () => {
  it("spans the intended range and increases monotonically", () => {
    expect(sliderToRequests(0)).toBe(MIN_REQUESTS);
    expect(sliderToRequests(SLIDER_STEPS)).toBe(MAX_SLIDER_REQUESTS);
    for (let p = 1; p <= SLIDER_STEPS; p += 1) {
      expect(sliderToRequests(p)).toBeGreaterThanOrEqual(sliderToRequests(p - 1));
    }
  });

  it("round-trips to within one step despite snapping", () => {
    for (let p = 0; p <= SLIDER_STEPS; p += 1) {
      expect(Math.abs(requestsToSlider(sliderToRequests(p)) - p)).toBeLessThanOrEqual(1);
    }
  });

  it("clamps a typed volume past the end of the slider", () => {
    expect(requestsToSlider(5_000_000)).toBe(SLIDER_STEPS);
    expect(requestsToSlider(1)).toBe(0);
  });
});

describe("costForTier", () => {
  it("charges nothing extra inside the allowance", () => {
    const row = costForTier(tier("standardPlus"), { requests: 10_000 });
    expect(row.available).toBe(true);
    expect(row.overageGbp).toBe(0);
    expect(row.monthlyGbp).toBe(96);
  });

  it("charges the plan's overage rate above it", () => {
    const row = costForTier(tier("standardPlus"), { requests: 25_000 });
    expect(row.overageRequests).toBe(15_000);
    expect(row.monthlyGbp).toBeCloseTo(276, 6);
  });

  it("rules out a plan with too few seats, since seats can't be bought (plan §6.12)", () => {
    const starter = costForTier(tier("starter"), { requests: 250, seats: 2 });
    expect(starter).toMatchObject({ available: false, reason: "Covers up to 1 user" });
    const professional = costForTier(tier("professional"), { requests: 250, seats: 20 });
    expect(professional.reason).toBe("Covers up to 15 users");
  });

  it("stops recommending a self-serve plan past the 50,000 ceiling", () => {
    const row = costForTier(tier("professional"), { requests: 60_000 });
    expect(row.reason).toBe("Self-serve goes up to 50,000 checks a month");
  });

  it("skips a band that has no price set", () => {
    const unpriced = { ...tier("enterprise50k"), monthlyPriceGbp: null };
    expect(costForTier(unpriced, { requests: 100 })).toMatchObject({
      available: false,
      reason: "Price on application",
    });
  });
});

describe("plan recommendation", () => {
  it.each([
    [250, "starter"],
    [1000, "starter"],
    [5000, "standardPlus"],
    [10_000, "standardPlus"],
    [24_999, "professional"],
    [40_000, "professional"],
    [50_000, "enterprise50k"],
    [100_000, "enterprise100k"],
    [200_000, "enterprise200k"],
    [400_000, "enterpriseCustom"],
  ])("recommends the cheapest tier at %i checks", (requests, expected) => {
    expect(recommend({ requests })).toBe(expected);
  });

  it("prefers Enterprise over Professional overage at 100,000 checks", () => {
    const quote = buildQuote({ requests: 100_000 });
    expect(quote.totals.monthlyGbp).toBe(440);
    expect(rowFor(quote, "professional").available).toBe(false);
  });

  it("moves a team onto a plan with enough seats", () => {
    expect(recommend({ requests: 250, seats: 1 })).toBe("starter");
    expect(recommend({ requests: 250, seats: 4 })).toBe("standardPlus");
    expect(recommend({ requests: 250, seats: 6 })).toBe("professional");
    expect(recommend({ requests: 250, seats: 20 })).toBe("enterpriseCustom");
  });

  it("agrees with the in-app recommendation for self-serve volumes", () => {
    for (const [checks, seats] of [
      [250, 1],
      [5000, 1],
      [20_000, 3],
      [250, 4],
      [250, 10],
    ]) {
      const app = recommendPlan({ monthlyChecks: checks, seatsUsed: seats });
      expect(recommend({ requests: checks, seats }), `${checks} checks, ${seats} seats`).toBe(
        app.tier,
      );
    }
  });

  it("falls back to a bespoke quote when no priced tier fits", () => {
    const quote = buildQuote({ requests: 400_000 });
    expect(quote.isQuoteOnly).toBe(true);
    expect(quote.totals).toEqual({ monthlyGbp: null, annualGbp: null });
    expect(quote.pencePerCheck).toBeNull();
    expect(rowFor(quote, "enterprise100k").reason).toBe("Covers up to 300,000 checks a month");
  });
});

describe("EISCD", () => {
  it("adds the licence to both totals without touching the per-check rate", () => {
    const without = buildQuote({ requests: 10_000 });
    const withEiscd = buildQuote({ requests: 10_000, includeEiscd: true });
    expect(withEiscd.eiscd?.annualGbp).toBe(2130);
    expect(withEiscd.totals.monthlyGbp).toBeCloseTo(96 + 2130 / 12, 6);
    expect(withEiscd.totals.annualGbp).toBe(96 * 12 + 2130);
    expect(withEiscd.pencePerCheck).toBe(without.pencePerCheck);
    expect(without.eiscd).toBeNull();
  });
});

describe("blended rate", () => {
  it("reports the effective pence per check", () => {
    expect(buildQuote({ requests: 100_000 }).pencePerCheck).toBeCloseTo(0.44, 6);
    expect(buildQuote({ requests: 10_000 }).pencePerCheck).toBeCloseTo(0.96, 6);
    expect(buildQuote({ requests: 0 }).pencePerCheck).toBeNull();
  });

  it("uses the plans.ts prices", () => {
    expect(buildQuote({ requests: 250 }).totals.monthlyGbp).toBe(PLANS.starter.monthlyPriceGbp);
  });
});
