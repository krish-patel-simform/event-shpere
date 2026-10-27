import {
  changeUserRoleBodySchema,
  inviteUserBodySchema,
  SUSPEND_REASON_MAX,
  suspendUserBodySchema,
} from "../admin-users.schemas";

describe("suspendUserBodySchema", () => {
  it("trims the reason and keeps the notify choice", () => {
    expect(
      suspendUserBodySchema.parse({ reason: "  Spam  ", notifyUser: false }),
    ).toEqual({ reason: "Spam", notifyUser: false });
  });

  it("needs a reason, even if it is only spaces", () => {
    expect(
      suspendUserBodySchema.safeParse({ reason: "  ", notifyUser: true })
        .success,
    ).toBe(false);
  });

  it(`refuses a reason over ${SUSPEND_REASON_MAX} characters`, () => {
    const reason = "x".repeat(SUSPEND_REASON_MAX + 1);
    expect(
      suspendUserBodySchema.safeParse({ reason, notifyUser: true }).success,
    ).toBe(false);
  });
});

describe("changeUserRoleBodySchema", () => {
  it.each(["user", "speaker", "organizer", "admin"])("accepts %s", (role) => {
    expect(changeUserRoleBodySchema.safeParse({ role }).success).toBe(true);
  });

  it("refuses a role that does not exist (guest is not a role)", () => {
    expect(changeUserRoleBodySchema.safeParse({ role: "guest" }).success).toBe(
      false,
    );
  });
});

describe("inviteUserBodySchema", () => {
  const valid = {
    firstName: " Vikram ",
    lastName: "Mehta",
    email: "  Vikram.Mehta@Example.COM ",
    role: "speaker",
  };

  it("trims names and lowercases the email (users.email is stored lowercase)", () => {
    expect(inviteUserBodySchema.parse(valid)).toEqual({
      firstName: "Vikram",
      lastName: "Mehta",
      email: "vikram.mehta@example.com",
      role: "speaker",
    });
  });

  it("an invited user can be a speaker, organizer or administrator, not a plain attendee", () => {
    expect(
      inviteUserBodySchema.safeParse({ ...valid, role: "admin" }).success,
    ).toBe(true);
    expect(
      inviteUserBodySchema.safeParse({ ...valid, role: "user" }).success,
    ).toBe(false);
  });

  it("refuses a missing name or a bad email", () => {
    expect(
      inviteUserBodySchema.safeParse({ ...valid, firstName: " " }).success,
    ).toBe(false);
    expect(
      inviteUserBodySchema.safeParse({ ...valid, email: "not-an-email" })
        .success,
    ).toBe(false);
  });
});
