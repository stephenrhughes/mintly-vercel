import { describe, expect, it } from "vitest";

import { describeSubscription, showKeyNotice, type SubscriptionView } from "./status";

const view = (overrides: Partial<SubscriptionView> = {}): SubscriptionView => ({
  id: "s1",
  product: "bank_checker",
  stripePriceId: "price_1",
  status: "active",
  trialing: false,
  trialEnd: null,
  currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
  cancelAt: null,
  expired: false,
  maxTeamSize: 1,
  extraUsers: 0,
  apiKeyId: "key_1",
  keyEnabled: true,
  keyNoticeAt: null,
  keyNoticeDismissedAt: null,
  ...overrides,
});

describe("describeSubscription", () => {
  it("is active only when not expired and the key is enabled (SUB-02)", () => {
    expect(describeSubscription(view()).active).toBe(true);
    expect(describeSubscription(view({ keyEnabled: false })).active).toBe(false);
    expect(describeSubscription(view({ apiKeyId: null })).active).toBe(false);
    expect(describeSubscription(view({ expired: true })).active).toBe(false);
  });

  it("labels each state with its date", () => {
    expect(describeSubscription(view())).toMatchObject({
      label: "Active",
      dateLine: "Renews on 1 December 2026",
    });
    expect(
      describeSubscription(
        view({ trialing: true, status: "trialing", trialEnd: new Date("2026-11-24T12:00:00Z") }),
      ),
    ).toMatchObject({ label: "Free trial", dateLine: "Trial ends on 24 November 2026" });
    expect(
      describeSubscription(view({ cancelAt: new Date("2026-12-01T00:00:00Z") })),
    ).toMatchObject({
      label: "Cancelling",
      tone: "warning",
      dateLine: "Ends on 1 December 2026",
    });
    expect(describeSubscription(view({ status: "past_due" }))).toMatchObject({
      label: "Payment overdue",
    });
    expect(
      describeSubscription(
        view({ expired: true, status: "canceled", cancelAt: new Date("2026-10-01T00:00:00Z") }),
      ),
    ).toMatchObject({ label: "Ended", dateLine: "Ended on 1 October 2026" });
  });

  it("shows a trial with no key yet as inactive", () => {
    expect(describeSubscription(view({ trialing: true, apiKeyId: null }))).toMatchObject({
      label: "Free trial",
      tone: "inactive",
      active: false,
    });
  });
});

describe("showKeyNotice (BILL-08)", () => {
  it("shows until dismissed", () => {
    expect(showKeyNotice(view())).toBe(false);
    expect(showKeyNotice(view({ keyNoticeAt: new Date() }))).toBe(true);
    expect(showKeyNotice(view({ keyNoticeAt: new Date(), keyNoticeDismissedAt: new Date() }))).toBe(
      false,
    );
  });
});
