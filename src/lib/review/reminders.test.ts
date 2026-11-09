import { describe, expect, it } from "vitest";

import { planReminders } from "./reminders";

const now = new Date("2026-11-10T15:00:00Z"); // Tuesday, 15:00 UK time

describe("planReminders (APPR-07)", () => {
  it("reminds once about reviews waiting 4 working hours, and expires week-old ones", () => {
    expect(
      planReminders(
        [
          { id: "fresh", createdAt: new Date("2026-11-10T13:00:00Z"), reminderSentAt: null },
          { id: "overdue", createdAt: new Date("2026-11-10T09:00:00Z"), reminderSentAt: null },
          {
            id: "reminded",
            createdAt: new Date("2026-11-09T09:00:00Z"),
            reminderSentAt: new Date("2026-11-09T13:00:00Z"),
          },
          { id: "old", createdAt: new Date("2026-11-03T14:00:00Z"), reminderSentAt: null },
        ],
        now,
      ),
    ).toEqual({ expire: ["old"], remind: ["overdue"] });
  });

  it("doesn't count the weekend towards the reminder", () => {
    const monday = new Date("2026-11-16T10:00:00Z");
    expect(
      planReminders(
        [{ id: "friday", createdAt: new Date("2026-11-13T16:00:00Z"), reminderSentAt: null }],
        monday,
      ),
    ).toEqual({ expire: [], remind: [] });
  });
});
