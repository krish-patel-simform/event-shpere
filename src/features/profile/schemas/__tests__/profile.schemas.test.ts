/** @jest-environment jsdom */
import { VALID_PASSWORD } from "../../__fixtures__/profile";
import {
  changePasswordFormSchema,
  profileFormSchema,
} from "../profile.schemas";

function messages(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return (
    result.error?.issues.map((i) => `${String(i.path[0])}: ${i.message}`) ?? []
  );
}

describe("profileFormSchema", () => {
  it("trims the names", () => {
    const result = profileFormSchema.parse({
      firstName: "  Ananya ",
      lastName: " Rao  ",
    });
    expect(result).toEqual({ firstName: "Ananya", lastName: "Rao" });
  });

  it("requires both names, and a blank name counts as empty", () => {
    const result = profileFormSchema.safeParse({
      firstName: "   ",
      lastName: "",
    });
    expect(messages(result)).toEqual([
      "firstName: First name is required",
      "lastName: Last name is required",
    ]);
  });

  it("limits a name to 100 characters", () => {
    const result = profileFormSchema.safeParse({
      firstName: "a".repeat(101),
      lastName: "Rao",
    });
    expect(messages(result)).toEqual(["firstName: Use at most 100 characters"]);
  });
});

describe("changePasswordFormSchema", () => {
  const valid = {
    currentPassword: "Old!Passw0rd",
    newPassword: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
  };

  it("accepts a strong new password that is confirmed", () => {
    expect(changePasswordFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires the current password and the confirmation", () => {
    const result = changePasswordFormSchema.safeParse({
      currentPassword: "",
      newPassword: VALID_PASSWORD,
      confirmPassword: "",
    });
    expect(messages(result)).toEqual(
      expect.arrayContaining([
        "currentPassword: Enter your current password",
        "confirmPassword: Confirm your new password",
      ]),
    );
  });

  it("applies the shared password policy to the new password", () => {
    const result = changePasswordFormSchema.safeParse({
      ...valid,
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
    expect(
      messages(result).some((m) => m.startsWith("newPassword: Password must")),
    ).toBe(true);
  });

  it("rejects a confirmation that does not match", () => {
    const result = changePasswordFormSchema.safeParse({
      ...valid,
      confirmPassword: `${VALID_PASSWORD}x`,
    });
    expect(messages(result)).toEqual([
      "confirmPassword: Passwords do not match",
    ]);
  });

  it("rejects a new password equal to the current one", () => {
    const result = changePasswordFormSchema.safeParse({
      ...valid,
      currentPassword: VALID_PASSWORD,
    });
    expect(messages(result)).toEqual([
      "newPassword: Choose a password that is different from the current one",
    ]);
  });
});
