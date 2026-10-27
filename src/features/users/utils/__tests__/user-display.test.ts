import {
  adminActionsFor,
  ROLE_DESCRIPTIONS,
  roleBadge,
  statusBadge,
  tabFilter,
  USER_TABS,
  userFullName,
} from "../user-display";

describe("ROLE_DESCRIPTIONS", () => {
  it("describes every role", () => {
    for (const role of ["user", "speaker", "organizer", "admin"] as const) {
      expect(ROLE_DESCRIPTIONS[role].length).toBeGreaterThan(10);
    }
  });
});

describe("adminActionsFor", () => {
  it("an active attendee can be suspended and sent a reset link, not reactivated", () => {
    expect(adminActionsFor({ status: "active", role: "user" })).toEqual({
      canSuspend: true,
      canReactivate: false,
      canSendResetLink: true,
      canResendInvite: false,
      resetLinkUnavailable: null,
    });
  });

  it("an administrator is never suspended or sent a reset link (the server refuses both)", () => {
    const actions = adminActionsFor({ status: "active", role: "admin" });

    expect(actions.canSuspend).toBe(false);
    expect(actions.canSendResetLink).toBe(false);
  });

  it("a suspended user can be reactivated, but not sent a reset link, and the page says why", () => {
    const actions = adminActionsFor({ status: "suspended", role: "speaker" });

    expect(actions.canReactivate).toBe(true);
    expect(actions.canSuspend).toBe(false);
    expect(actions.canSendResetLink).toBe(false);
    expect(actions.resetLinkUnavailable).toMatch(/suspended/);
  });

  it("a pending user has no password yet: no reset link, but the set-password invite can be sent again", () => {
    const actions = adminActionsFor({ status: "pending", role: "organizer" });

    expect(actions.canSuspend).toBe(false);
    expect(actions.canReactivate).toBe(false);
    expect(actions.canSendResetLink).toBe(false);
    expect(actions.canResendInvite).toBe(true);
    expect(actions.resetLinkUnavailable).toBeNull();
  });

  it("the invite is for a pending account of any role, and only for those", () => {
    for (const role of ["user", "speaker", "organizer"] as const) {
      expect(adminActionsFor({ status: "pending", role }).canResendInvite).toBe(
        true,
      );
    }
    expect(
      adminActionsFor({ status: "active", role: "user" }).canResendInvite,
    ).toBe(false);
    expect(
      adminActionsFor({ status: "suspended", role: "user" }).canResendInvite,
    ).toBe(false);
  });

  it("an account with no role is treated like any other active account", () => {
    expect(adminActionsFor({ status: "active", role: null }).canSuspend).toBe(
      true,
    );
  });
});

describe("roleBadge", () => {
  it.each([
    ["user", "Attendee", "brand"],
    ["speaker", "Speaker", "success"],
    ["organizer", "Organizer", "neutral"],
    ["admin", "Administrator", "surface"],
  ] as const)("%s → %s", (role, label, tone) => {
    expect(roleBadge(role)).toEqual({ label, tone });
  });

  it("says so for an account with no role", () => {
    expect(roleBadge(null)).toEqual({ label: "No role", tone: "neutral" });
  });
});

describe("statusBadge", () => {
  it("labels each account status", () => {
    expect(statusBadge("active").label).toBe("Active");
    expect(statusBadge("suspended")).toEqual({
      label: "Suspended",
      tone: "danger",
    });
    expect(statusBadge("pending").label).toBe("Pending");
  });
});

describe("userFullName", () => {
  it("joins first and last name", () => {
    expect(userFullName({ firstName: "Ananya", lastName: "Rao" })).toBe(
      "Ananya Rao",
    );
  });
});

describe("USER_TABS", () => {
  it("has no tab whose numbers or filter the API cannot give yet (unverified email)", () => {
    expect(USER_TABS.map((tab) => tab.key)).toEqual([
      "all",
      "user",
      "speaker",
      "organizer",
      "admin",
      "suspended",
    ]);
  });
});

describe("tabFilter", () => {
  it("'all' asks for no filter", () => {
    expect(tabFilter("all")).toEqual({});
  });

  it.each(["user", "speaker", "organizer", "admin"] as const)(
    "the %s tab asks for that role",
    (role) => {
      expect(tabFilter(role)).toEqual({ role });
    },
  );

  it("the suspended tab asks for the suspended status, not a role", () => {
    expect(tabFilter("suspended")).toEqual({ status: "suspended" });
  });
});
