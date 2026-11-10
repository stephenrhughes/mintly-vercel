import { describe, expect, it } from "vitest";

import {
  canManageTeam,
  inviteDomainProblem,
  inviteErrorMessage,
  inviteExpiryLabel,
  isInvitableRole,
  joinErrorMessage,
  memberChangeProblem,
  teamErrorHint,
  teamFullFromDetail,
} from "./rules";

describe("canManageTeam (TEAM-04, TEAM-08)", () => {
  it("lets only the owner change the team", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("developer")).toBe(false);
    expect(canManageTeam("member")).toBe(false);
    expect(canManageTeam(null)).toBe(false);
  });
});

describe("isInvitableRole", () => {
  it("allows developers and members, never owners", () => {
    expect(isInvitableRole("developer")).toBe(true);
    expect(isInvitableRole("member")).toBe(true);
    expect(isInvitableRole("owner")).toBe(false);
    expect(isInvitableRole("admin")).toBe(false);
  });
});

describe("inviteDomainProblem (TEAM-04, plan §6.6)", () => {
  const owner = "olivia@acme.co.uk";

  it("allows the owner's own domain, ignoring case", () => {
    expect(
      inviteDomainProblem({
        ownerEmail: owner,
        inviteeEmail: "Mia@ACME.co.uk",
        allowExternal: false,
      }),
    ).toBeNull();
  });

  it("refuses other domains, naming the allowed one", () => {
    expect(
      inviteDomainProblem({
        ownerEmail: owner,
        inviteeEmail: "mia@contractor.com",
        allowExternal: false,
      }),
    ).toMatch(/@acme\.co\.uk/);
  });

  it("allows other domains when an admin has allowed them", () => {
    expect(
      inviteDomainProblem({
        ownerEmail: owner,
        inviteeEmail: "mia@contractor.com",
        allowExternal: true,
      }),
    ).toBeNull();
  });

  it("refuses an address with no valid domain", () => {
    expect(
      inviteDomainProblem({ ownerEmail: owner, inviteeEmail: "mia@", allowExternal: true }),
    ).toBe("Enter a valid email address");
  });
});

describe("memberChangeProblem (TEAM-08)", () => {
  const actorId = "owner-id";

  it("never lets the owner remove or demote themselves", () => {
    const target = { userId: actorId, role: "owner" as const };
    expect(memberChangeProblem({ actorId, target, change: "remove" })).toMatch(/yourself/);
    expect(memberChangeProblem({ actorId, target, change: "role" })).toMatch(/own role/);
  });

  it("never changes the owner", () => {
    const target = { userId: "other", role: "owner" as const };
    expect(memberChangeProblem({ actorId, target, change: "remove" })).toMatch(/transfer/);
  });

  it("refuses someone outside the team", () => {
    expect(memberChangeProblem({ actorId, target: null, change: "remove" })).toMatch(/isn't in/);
  });

  it("allows changes to developers and members", () => {
    for (const role of ["developer", "member"] as const) {
      expect(
        memberChangeProblem({ actorId, target: { userId: "x", role }, change: "remove" }),
      ).toBeNull();
    }
  });
});

describe("database errors", () => {
  it("reads known hints and ignores others", () => {
    expect(teamErrorHint({ hint: "team_full" })).toBe("team_full");
    expect(teamErrorHint({ hint: "something_else" })).toBeNull();
    expect(teamErrorHint(null)).toBeNull();
  });

  it("turns the seat detail into the team-full message (TEAM-05)", () => {
    expect(teamFullFromDetail("3/3")).toMatch(/^Your team is full \(3 of 3 seats used\)/);
    expect(teamFullFromDetail(null)).toMatch(/^Your team is full\./);
    expect(inviteErrorMessage("team_full", "4/4")).toMatch(/4 of 4/);
    expect(inviteErrorMessage("already_member")).toMatch(/already in your team/);
    expect(inviteErrorMessage(null)).toBeNull();
  });

  it("explains each join refusal (JOIN-02 to JOIN-06)", () => {
    expect(joinErrorMessage("wrong_email", { invitedEmail: "mia@acme.test" })).toMatch(
      /sent to mia@acme\.test/,
    );
    expect(joinErrorMessage("already_member")).toBe("You've already joined your team.");
    expect(joinErrorMessage("expired")).toMatch(/expired/);
    expect(joinErrorMessage("not_subscribed", { orgName: "Acme" })).toMatch(
      /Acme no longer has an active subscription/,
    );
    expect(joinErrorMessage("owner_elsewhere")).toMatch(/owner of another organisation/);
  });
});

describe("inviteExpiryLabel", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("describes held, open and expired invites", () => {
    expect(inviteExpiryLabel(null, now)).toBe("Held until your account is approved");
    expect(inviteExpiryLabel(new Date("2026-11-24T12:00:00Z"), now)).toBe("Expires in 14 days");
    expect(inviteExpiryLabel(new Date("2026-11-10T18:00:00Z"), now)).toBe("Expires within a day");
    expect(inviteExpiryLabel(new Date("2026-11-09T12:00:00Z"), now)).toBe("Expired");
  });
});
