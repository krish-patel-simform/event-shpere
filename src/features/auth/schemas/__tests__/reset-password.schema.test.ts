import {
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
} from "../auth.schemas";

const valid = {
  token: "raw-token-from-the-email-link",
  password: "NewSecret1!",
  confirmPassword: "NewSecret1!",
};

describe("resetPasswordBodySchema", () => {
  it("accepts a token with a strong password that is confirmed", () => {
    expect(resetPasswordBodySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty token", () => {
    expect(
      resetPasswordBodySchema.safeParse({ ...valid, token: "" }).success,
    ).toBe(false);
  });

  it("rejects an absurdly long token", () => {
    expect(
      resetPasswordBodySchema.safeParse({ ...valid, token: "x".repeat(201) })
        .success,
    ).toBe(false);
  });

  it("rejects a weak password", () => {
    const result = resetPasswordBodySchema.safeParse({
      ...valid,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a confirmation that differs, and reports it on confirmPassword", () => {
    const result = resetPasswordBodySchema.safeParse({
      ...valid,
      confirmPassword: "Different1!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toContain(
        "confirmPassword",
      );
    }
  });
});

describe("forgotPasswordBodySchema", () => {
  it("trims and lowercases the email, so it matches the stored lowercase address", () => {
    const result = forgotPasswordBodySchema.parse({
      email: "  Olga@Acme.TEST ",
    });
    expect(result.email).toBe("olga@acme.test");
  });

  it("rejects something that is not an email", () => {
    expect(
      forgotPasswordBodySchema.safeParse({ email: "not-an-email" }).success,
    ).toBe(false);
  });
});
