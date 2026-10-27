import { userDetailResponseSchema, userParamSchema } from "../users.schema";

const detail = {
  id: "8f2c41a0-6b1e-4c52-9a3d-7e5b1c0d2f34",
  firstName: "Ananya",
  lastName: "Rao",
  email: "ananya.rao@example.com",
  status: "active",
  role: "user",
  emailVerifiedAt: "2026-10-20T09:21:00.000Z",
  createdAt: "2026-10-20T09:18:00.000Z",
  hasPassword: true,
  permissions: ["PROFILE_VIEW", "REGISTRATION_CREATE"],
};

describe("userDetailResponseSchema", () => {
  it("accepts an active user", () => {
    expect(userDetailResponseSchema.safeParse(detail).success).toBe(true);
  });

  it.each(["user", "speaker", "organizer", "admin"])(
    "accepts a %s: the page is the same for every role",
    (role) => {
      expect(
        userDetailResponseSchema.safeParse({ ...detail, role }).success,
      ).toBe(true);
    },
  );

  it("accepts an invited account: no password, no verified email, no role", () => {
    const result = userDetailResponseSchema.safeParse({
      ...detail,
      status: "pending",
      role: null,
      hasPassword: false,
      emailVerifiedAt: null,
      permissions: [],
    });

    expect(result.success).toBe(true);
  });

  it("has nothing about an organizer application or a speaker profile", () => {
    const parsed = userDetailResponseSchema.parse({
      ...detail,
      organizerApplication: { id: "x" },
      speakerProfile: { slug: "ananya" },
    });

    expect(parsed).not.toHaveProperty("organizerApplication");
    expect(parsed).not.toHaveProperty("speakerProfile");
  });

  it("drops a field it does not list, so a sensitive column added to the query never leaves", () => {
    const parsed = userDetailResponseSchema.parse({
      ...detail,
      passwordHash: "secret",
    });

    expect(JSON.stringify(parsed)).not.toContain("secret");
  });

  it.each([
    ["status", "banned"],
    ["role", "superuser"],
    ["email", "not-an-email"],
    ["createdAt", "yesterday"],
    ["hasPassword", "yes"],
  ])("rejects a bad %s", (key, value) => {
    expect(
      userDetailResponseSchema.safeParse({ ...detail, [key]: value }).success,
    ).toBe(false);
  });
});

describe("userParamSchema (the id of the user to read)", () => {
  it("takes a user id and refuses anything else", () => {
    expect(userParamSchema.safeParse({ userId: detail.id }).success).toBe(true);
    expect(
      userParamSchema.safeParse({ userId: "1; drop table users" }).success,
    ).toBe(false);
  });
});
