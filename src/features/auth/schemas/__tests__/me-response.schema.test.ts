import { meResponseSchema } from "../auth.schemas";

const valid = {
  id: "0b0f6a1e-6a0d-4f6e-9a55-1f6f2f0f9a11",
  firstName: "Ann",
  lastName: "Attendee",
  email: "ann@example.test",
  role: "user",
  permissions: ["PROFILE_MANAGE"],
};

describe("meResponseSchema", () => {
  it("accepts the signed-in user with their permissions", () => {
    expect(meResponseSchema.parse(valid)).toEqual(valid);
  });

  it("drops fields that are not part of the contract (nothing sensitive can leak)", () => {
    const parsed = meResponseSchema.parse({
      ...valid,
      passwordHash: "$argon2id$secret",
      sessionId: "s1",
    });

    expect(parsed).not.toHaveProperty("passwordHash");
    expect(parsed).not.toHaveProperty("sessionId");
  });

  it("rejects an unknown role, a bad id and a missing permissions list", () => {
    for (const bad of [
      { role: "guest" },
      { id: "not-a-uuid" },
      { permissions: undefined },
      { permissions: "PROFILE_MANAGE" },
    ]) {
      expect(meResponseSchema.safeParse({ ...valid, ...bad }).success).toBe(
        false,
      );
    }
  });
});
