import { describe, expect, it } from "vitest";

import {
  type ChangeRequest,
  classifyChange,
  type CurrentPlan,
  dueTrialReminder,
  recommendPlan,
} from "./change-plan";

const paid = (overrides: Partial<CurrentPlan> = {}): CurrentPlan => ({
  status: "active",
  trialing: false,
  cancelAt: null,
  priceId: "price_plus_m",
  tier: "standardPlus",
  interval: "monthly",
  custom: false,
  reviewStatus: "approved",
  ...overrides,
});
const trial = (overrides: Partial<CurrentPlan> = {}) =>
  paid({
    status: "trialing",
    trialing: true,
    tier: "starter",
    priceId: "price_starter_m",
    ...overrides,
  });

const to = (
  tier: ChangeRequest["tier"],
  interval: ChangeRequest["interval"] = "monthly",
  mode: ChangeRequest["mode"] = "switch",
) => ({
  tier,
  interval,
  mode,
});
const team = (seatsUsed = 1, extraUsers = 0) => ({ seatsUsed, extraUsers });

const kind = (c: ReturnType<typeof classifyChange>) => (c.allowed ? c.kind : c.reason);

describe("classifyChange during a trial", () => {
  it("switches tier, up or down, keeping the trial (PLAN-02)", () => {
    expect(kind(classifyChange(trial(), to("professional"), team()))).toBe("trial_switch");
    expect(kind(classifyChange(trial({ tier: "professional" }), to("starter"), team()))).toBe(
      "trial_switch",
    );
    expect(kind(classifyChange(trial(), to("starter", "annual"), team()))).toBe("trial_switch");
  });

  it("starts paying now on any plan once approved, including the current one (PLAN-03)", () => {
    expect(kind(classifyChange(trial(), to("professional", "annual", "start_paid"), team()))).toBe(
      "start_paid",
    );
    expect(kind(classifyChange(trial(), to("starter", "monthly", "start_paid"), team()))).toBe(
      "start_paid",
    );
  });

  it("lets a pending organisation switch, but not start paying (plan §6.12)", () => {
    const pending = trial({ reviewStatus: "pending_review" });
    expect(kind(classifyChange(pending, to("professional"), team()))).toBe("trial_switch");
    expect(kind(classifyChange(pending, to("professional", "monthly", "start_paid"), team()))).toBe(
      "pending_review",
    );
  });

  it("refuses switching to the plan it's already on", () => {
    expect(kind(classifyChange(trial(), to("starter"), team()))).toBe("same_plan");
  });
});

describe("classifyChange on a paid plan (PLAN-04)", () => {
  it("upgrades now to a higher tier, or monthly to annual", () => {
    expect(kind(classifyChange(paid(), to("professional"), team()))).toBe("upgrade");
    expect(kind(classifyChange(paid(), to("professional", "annual"), team()))).toBe("upgrade");
    expect(kind(classifyChange(paid(), to("standardPlus", "annual"), team()))).toBe("upgrade");
  });

  it("schedules a lower tier, or annual to monthly, for the end of the period", () => {
    expect(kind(classifyChange(paid(), to("starter"), team()))).toBe("downgrade_scheduled");
    expect(kind(classifyChange(paid({ interval: "annual" }), to("standardPlus"), team()))).toBe(
      "downgrade_scheduled",
    );
    // A higher tier but a shorter period still waits: an annual period can't be cut short.
    expect(kind(classifyChange(paid({ interval: "annual" }), to("professional"), team()))).toBe(
      "downgrade_scheduled",
    );
    expect(kind(classifyChange(paid(), to("starter", "annual"), team()))).toBe(
      "downgrade_scheduled",
    );
  });

  it("moves a legacy price to a current plan straight away", () => {
    expect(
      kind(
        classifyChange(
          paid({ tier: null, interval: null, priceId: "price_old" }),
          to("starter"),
          team(),
        ),
      ),
    ).toBe("upgrade");
  });

  it("refuses the current plan", () => {
    expect(kind(classifyChange(paid(), to("standardPlus"), team()))).toBe("same_plan");
  });
});

describe("classifyChange refusals", () => {
  it("sends custom prices to Mintly (PLAN-10)", () => {
    const result = classifyChange(
      paid({ custom: true, tier: null, interval: null }),
      to("professional"),
      team(),
    );
    expect(result).toMatchObject({ allowed: false, reason: "custom_price" });
  });

  it("blocks a plan with fewer seats than the team uses, saying how many to remove (PLAN-06)", () => {
    expect(classifyChange(paid(), to("starter"), team(4))).toEqual({
      allowed: false,
      reason: "seats",
      message: "Starter Plan includes 1 seat and your team has 4. Remove 3 people first.",
    });
    // Extra seats an admin granted count (PLAN-11).
    expect(kind(classifyChange(paid(), to("starter"), team(3, 2)))).toBe("downgrade_scheduled");
  });

  it("allows a plan below recent usage, with a warning about overage (PLAN-06)", () => {
    const result = classifyChange(paid(), to("starter"), team(), { monthlyChecks: 1200 });
    expect(result.allowed && result.warnings).toEqual([
      "Your recent usage, about 1,200 checks a month, is more than the 250 Starter Plan includes, so you'd pay 5p for each check over.",
    ]);
  });

  it("refuses past-due, cancelling and ended subscriptions", () => {
    expect(kind(classifyChange(paid({ status: "past_due" }), to("professional"), team()))).toBe(
      "past_due",
    );
    expect(kind(classifyChange(paid({ cancelAt: new Date() }), to("professional"), team()))).toBe(
      "cancelling",
    );
    expect(kind(classifyChange(paid({ status: "canceled" }), to("professional"), team()))).toBe(
      "not_live",
    );
  });
});

describe("recommendPlan (PLAN-07)", () => {
  it("picks the smallest plan that fits the team", () => {
    expect(recommendPlan({ seatsUsed: 1, monthlyChecks: null }).tier).toBe("starter");
    expect(recommendPlan({ seatsUsed: 3, monthlyChecks: null }).tier).toBe("standardPlus");
    expect(recommendPlan({ seatsUsed: 12, monthlyChecks: null }).tier).toBe("professional");
  });

  it("takes usage into account once it is known", () => {
    expect(recommendPlan({ seatsUsed: 1, monthlyChecks: 4000 })).toEqual({
      tier: "standardPlus",
      reason: "Standard Plus Plan fits your team of 1 and covers about 4,000 checks a month.",
    });
    expect(recommendPlan({ seatsUsed: 1, monthlyChecks: 60_000 }).tier).toBeNull();
  });
});

describe("dueTrialReminder (PLAN-08)", () => {
  const end = new Date("2026-11-20T12:00:00Z");
  const at = (iso: string) => new Date(iso);

  it("sends at 7, 3 and 1 days before the end, once each", () => {
    expect(dueTrialReminder(end, at("2026-11-12T12:00:00Z"), [])).toBeNull(); // 8 days
    expect(dueTrialReminder(end, at("2026-11-13T13:00:00Z"), [])).toEqual({
      send: 7,
      markSent: [7],
    });
    expect(dueTrialReminder(end, at("2026-11-14T12:00:00Z"), [7])).toBeNull();
    expect(dueTrialReminder(end, at("2026-11-17T13:00:00Z"), [7])).toEqual({
      send: 3,
      markSent: [3],
    });
    expect(dueTrialReminder(end, at("2026-11-19T13:00:00Z"), [7, 3])).toEqual({
      send: 1,
      markSent: [1],
    });
  });

  it("sends only the nearest reminder when several are due", () => {
    expect(dueTrialReminder(end, at("2026-11-18T13:00:00Z"), [])).toEqual({
      send: 3,
      markSent: [7, 3],
    });
  });

  it("sends nothing once the trial has ended", () => {
    expect(dueTrialReminder(end, at("2026-11-21T12:00:00Z"), [])).toBeNull();
  });
});
