import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from "../../../core/http/errors";
import {
  loginBodySchema,
  organizerSignupBodySchema,
  userSignupBodySchema,
  userSignupResponseSchema,
} from "../schemas/auth.schemas";
import { createAuthService, type AuthServiceDeps } from "../server/auth.service";

// Empty factories: the real modules (DB client, env, jsonwebtoken, Redis, Resend) are never
// loaded. The service under test gets fakes through createAuthService instead.
jest.mock("../../../core/auth/server/auth-session", () => ({}));
jest.mock("../../../core/auth/server/password", () => ({}));
jest.mock("../server/auth.repository", () => ({}));
jest.mock("../../email/server", () => ({}));

const activeUser = {
  id: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
  firstName: "Ada",
  lastName: "Admin",
  email: "ada@example.com",
  passwordHash: "$argon2id$stored-hash",
  status: "active" as "active" | "pending" | "suspended",
};

const tokens = {
  accessToken: { token: "access", expiresAt: new Date() },
  refreshToken: { token: "refresh", expiresAt: new Date() },
};

function setup(
  user: typeof activeUser | (Omit<typeof activeUser, "passwordHash"> & { passwordHash: null }) | null = activeUser,
  overrides: Partial<AuthServiceDeps> = {},
) {
  const deps = {
    authRepository: {
      findUserForLogin: jest.fn().mockResolvedValue(user),
      signUpUser: jest.fn(),
      isEmailTaken: jest.fn().mockResolvedValue(false),
      signUpOrganizer: jest.fn(),
    },
    hashPassword: jest.fn().mockResolvedValue("$argon2id$dummy-hash"),
    verifyPassword: jest.fn().mockResolvedValue(true),
    createAuthSession: jest.fn().mockResolvedValue({ tokens, role: "admin" }),
    createEmailVerifyToken: jest.fn().mockReturnValue({
      token: "raw-verify-token/with+chars",
      tokenHash: "hashed-verify-token",
      expiresAt: new Date("2026-10-19T10:05:00.000Z"),
    }),
    createEmailOtp: jest.fn(),
    emailOtpStore: { save: jest.fn() },
    sendVerificationCodeEmail: jest.fn(),
    verificationCodeTtlMinutes: 5,
    appUrl: "http://localhost:3000",
    ...overrides,
  } satisfies AuthServiceDeps;
  return { deps, service: createAuthService(deps) };
}

const input = { email: "ada@example.com", password: "correct-password" };

describe("authService.login", () => {
  it("returns the user DTO (no permissions, no hash) and tokens for valid credentials", async () => {
    const { deps, service } = setup();

    const result = await service.login(input, "PostmanRuntime");

    expect(deps.verifyPassword).toHaveBeenCalledWith(
      activeUser.passwordHash,
      "correct-password",
    );
    expect(deps.createAuthSession).toHaveBeenCalledWith(
      activeUser.id,
      "PostmanRuntime",
    );
    expect(result.tokens).toBe(tokens);
    expect(result.user).toEqual({
      id: activeUser.id,
      firstName: "Ada",
      lastName: "Admin",
      email: "ada@example.com",
      role: "admin",
    });
  });

  it("rejects an unknown email with 401", async () => {
    const { deps, service } = setup(null);

    await expect(service.login(input, null)).rejects.toThrow(
      new UnauthorizedError("Invalid email or password"),
    );
    expect(deps.createAuthSession).not.toHaveBeenCalled();
  });

  it("tells a pending account (no password) to set its password first", async () => {
    const { deps, service } = setup({
      ...activeUser,
      passwordHash: null,
      status: "pending",
    });

    const error = await service.login(input, null).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toMatchObject({ status: 403, code: "PASSWORD_NOT_SET" });
    expect(deps.createAuthSession).not.toHaveBeenCalled();
  });

  it("tells a signed-up account (password, email not verified) to verify its email", async () => {
    const { deps, service } = setup({ ...activeUser, status: "pending" });

    const error = await service.login(input, null).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 403, code: "EMAIL_NOT_VERIFIED" });
    expect(deps.createAuthSession).not.toHaveBeenCalled();
  });

  it("gives an unverified account with a wrong password the generic 401", async () => {
    const { service } = setup(
      { ...activeUser, status: "pending" },
      { verifyPassword: jest.fn().mockResolvedValue(false) },
    );

    await expect(service.login(input, null)).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a wrong password with 401", async () => {
    const { deps, service } = setup(activeUser, {
      verifyPassword: jest.fn().mockResolvedValue(false),
    });

    await expect(service.login(input, null)).rejects.toThrow(
      new UnauthorizedError("Invalid email or password"),
    );
    expect(deps.createAuthSession).not.toHaveBeenCalled();
  });

  it("tells a suspended account it is suspended, only with the right password", async () => {
    const { deps, service } = setup({ ...activeUser, status: "suspended" });

    const error = await service.login(input, null).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 403, code: "ACCOUNT_SUSPENDED" });
    expect(deps.createAuthSession).not.toHaveBeenCalled();
  });

  it("gives a suspended account with a wrong password the generic 401", async () => {
    const { service } = setup(
      { ...activeUser, status: "suspended" },
      { verifyPassword: jest.fn().mockResolvedValue(false) },
    );

    await expect(service.login(input, null)).rejects.toThrow(UnauthorizedError);
  });

  it("rejects an account without a role", async () => {
    const { service } = setup(activeUser, {
      createAuthSession: jest.fn().mockResolvedValue(null),
    });

    await expect(service.login(input, null)).rejects.toThrow(UnauthorizedError);
  });
});

describe("authService.signUpOrganizer", () => {
  const createdAt = new Date("2026-10-19T10:00:00.000Z");
  const newUser = {
    id: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
    firstName: "Olga",
    lastName: "Organizer",
    email: "olga@acme.test",
    passwordHash: "$argon2id$dummy-hash",
    emailVerifiedAt: null,
    status: "pending" as const,
    createdAt,
    updatedAt: createdAt,
  };
  const newProfile = {
    id: "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4",
    userId: newUser.id,
    organizationName: "Acme Events",
    organizationWebsite: null,
    verifiedAt: null,
    verifiedBy: null,
    createdAt,
    updatedAt: createdAt,
  };
  const signupInput = {
    firstName: "Olga",
    lastName: "Organizer",
    email: "olga@acme.test",
    password: "Str0ng-Passw0rd!",
    confirmPassword: "Str0ng-Passw0rd!",
    organizationName: "Acme Events",
  };

  function setupSignup(overrides: Partial<AuthServiceDeps> = {}) {
    return setup(activeUser, {
      authRepository: {
        findUserForLogin: jest.fn(),
        signUpUser: jest.fn(),
        isEmailTaken: jest.fn().mockResolvedValue(false),
        signUpOrganizer: jest
          .fn()
          .mockResolvedValue({ ok: true, user: newUser, profile: newProfile }),
      },
      createEmailOtp: jest
        .fn()
        .mockReturnValue({ otp: "123456", otpHash: "hashed-otp" }),
      emailOtpStore: { save: jest.fn().mockResolvedValue(undefined) },
      sendVerificationCodeEmail: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    });
  }

  it("creates the account with the password HASH, stores the code HASH, emails the code", async () => {
    const { deps, service } = setupSignup();

    const result = await service.signUpOrganizer(signupInput);

    expect(deps.hashPassword).toHaveBeenCalledWith("Str0ng-Passw0rd!");
    const repoInput = jest.mocked(deps.authRepository.signUpOrganizer).mock.calls[0][0];
    expect(repoInput.passwordHash).toBe("$argon2id$dummy-hash");
    expect(repoInput).not.toHaveProperty("password");
    expect(repoInput.organizationWebsite).toBeNull(); // undefined → null for the DB
    // The DB gets the link token's HASH only; the code goes to Redis, not the DB.
    expect(repoInput.verifyToken).toEqual({
      tokenHash: "hashed-verify-token",
      expiresAt: new Date("2026-10-19T10:05:00.000Z"),
    });
    expect(deps.emailOtpStore.save).toHaveBeenCalledWith("olga@acme.test", "hashed-otp");
    // The email gets the code and the RAW token in the link (URL-encoded).
    expect(deps.sendVerificationCodeEmail).toHaveBeenCalledWith({
      to: "olga@acme.test",
      firstName: "Olga",
      otp: "123456",
      verifyUrl:
        "http://localhost:3000/verify-email?token=raw-verify-token%2Fwith%2Bchars",
      expiresInMinutes: 5,
    });
    expect(result).toEqual({
      id: newProfile.id,
      userId: newUser.id,
      firstName: "Olga",
      lastName: "Organizer",
      email: "olga@acme.test",
      status: "pending",
      organizationName: "Acme Events",
      organizationWebsite: null,
      isVerified: false,
      createdAt: "2026-10-19T10:00:00.000Z",
      verificationEmailSent: true,
      verificationCodeExpiresInMinutes: 5,
    });
  });

  it("never returns the password hash, the code or the verify token", async () => {
    const { service } = setupSignup();

    const body = JSON.stringify(await service.signUpOrganizer(signupInput));

    expect(body).not.toContain("argon2");
    expect(body).not.toContain("123456");
    expect(body).not.toContain("hashed-otp");
    expect(body).not.toContain("verify-token");
  });

  it("rejects a known email with 409 before hashing anything", async () => {
    const { deps, service } = setupSignup({
      authRepository: {
        findUserForLogin: jest.fn(),
        signUpUser: jest.fn(),
        isEmailTaken: jest.fn().mockResolvedValue(true),
        signUpOrganizer: jest.fn(),
      },
    });

    const error = await service.signUpOrganizer(signupInput).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "EMAIL_TAKEN" });
    expect(deps.hashPassword).not.toHaveBeenCalled();
    expect(deps.authRepository.signUpOrganizer).not.toHaveBeenCalled();
  });

  it("returns 409 and sends nothing when a parallel signup took the email first", async () => {
    const { deps, service } = setupSignup({
      authRepository: {
        findUserForLogin: jest.fn(),
        signUpUser: jest.fn(),
        isEmailTaken: jest.fn().mockResolvedValue(false),
        signUpOrganizer: jest
          .fn()
          .mockResolvedValue({ ok: false, reason: "EMAIL_TAKEN" }),
      },
    });

    await expect(service.signUpOrganizer(signupInput)).rejects.toMatchObject({
      code: "EMAIL_TAKEN",
    });
    expect(deps.emailOtpStore.save).not.toHaveBeenCalled();
    expect(deps.sendVerificationCodeEmail).not.toHaveBeenCalled();
  });

  it("still succeeds, with verificationEmailSent false, when the email fails", async () => {
    const { service } = setupSignup({
      sendVerificationCodeEmail: jest.fn().mockRejectedValue(new Error("Resend down")),
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await service.signUpOrganizer(signupInput);

    expect(result.verificationEmailSent).toBe(false);
  });

  it("does not email a code that could not be stored (Redis down)", async () => {
    const { deps, service } = setupSignup({
      emailOtpStore: { save: jest.fn().mockRejectedValue(new Error("Redis down")) },
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await service.signUpOrganizer(signupInput);

    expect(deps.sendVerificationCodeEmail).not.toHaveBeenCalled();
    expect(result.verificationEmailSent).toBe(false);
  });
});

describe("authService.signUpUser", () => {
  const createdAt = new Date("2026-10-20T10:00:00.000Z");
  const newUser = {
    id: "3f2a1b7e-8c1f-4f6e-9a59-0d6f2a1b7e10",
    firstName: "Ann",
    lastName: "Attendee",
    email: "ann@example.test",
    passwordHash: "$argon2id$dummy-hash",
    emailVerifiedAt: null,
    status: "pending" as const,
    createdAt,
    updatedAt: createdAt,
  };
  const newProfile = {
    userId: newUser.id,
    avatarUrl: null,
    phone: "555-123-4567",
    city: null,
    postalCode: null,
  };
  const userInput = {
    firstName: "Ann",
    lastName: "Attendee",
    email: "ann@example.test",
    password: "Str0ng-Passw0rd!",
    confirmPassword: "Str0ng-Passw0rd!",
    phone: "555-123-4567",
  };

  function setupUserSignup(overrides: Partial<AuthServiceDeps> = {}) {
    return setup(activeUser, {
      authRepository: {
        findUserForLogin: jest.fn(),
        isEmailTaken: jest.fn().mockResolvedValue(false),
        signUpOrganizer: jest.fn(),
        signUpUser: jest
          .fn()
          .mockResolvedValue({ ok: true, user: newUser, profile: newProfile }),
      },
      createEmailOtp: jest
        .fn()
        .mockReturnValue({ otp: "123456", otpHash: "hashed-otp" }),
      emailOtpStore: { save: jest.fn().mockResolvedValue(undefined) },
      sendVerificationCodeEmail: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    });
  }

  it("stores hashes only, maps skipped fields to null, and emails code + link", async () => {
    const { deps, service } = setupUserSignup();

    const result = await service.signUpUser(userInput);

    const repoInput = jest.mocked(deps.authRepository.signUpUser).mock.calls[0][0];
    expect(repoInput.passwordHash).toBe("$argon2id$dummy-hash");
    expect(repoInput).not.toHaveProperty("password");
    // Only the link token's hash, never the raw token.
    expect(repoInput.verifyToken).toEqual({
      tokenHash: "hashed-verify-token",
      expiresAt: new Date("2026-10-19T10:05:00.000Z"),
    });
    // Skipped optional fields become null for the DB.
    expect(repoInput.city).toBeNull();
    expect(repoInput.postalCode).toBeNull();
    expect(repoInput.avatarUrl).toBeNull();
    expect(deps.emailOtpStore.save).toHaveBeenCalledWith("ann@example.test", "hashed-otp");
    expect(deps.sendVerificationCodeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ann@example.test",
        otp: "123456",
        verifyUrl:
          "http://localhost:3000/verify-email?token=raw-verify-token%2Fwith%2Bchars",
      }),
    );
    expect(result).toEqual({
      userId: newUser.id,
      firstName: "Ann",
      lastName: "Attendee",
      email: "ann@example.test",
      status: "pending",
      phone: "555-123-4567",
      city: null,
      postalCode: null,
      avatarUrl: null,
      isVerified: false,
      verificationEmailSent: true,
      verificationCodeExpiresInMinutes: 5,
    });
  });

  it("stores a left-out phone as null", async () => {
    const { deps, service } = setupUserSignup();
    await service.signUpUser({ ...userInput, phone: undefined });

    const repoInput = jest.mocked(deps.authRepository.signUpUser).mock.calls[0][0];
    expect(repoInput.phone).toBeNull();
  });

  it("returns exactly what the response schema accepts, with no hash, code or token", async () => {
    const { service } = setupUserSignup();

    const result = await service.signUpUser(userInput);

    // The route parses with this schema: a mismatch here would be a 500 in production.
    expect(userSignupResponseSchema.parse(result)).toEqual(result);
    const body = JSON.stringify(result);
    expect(body).not.toContain("argon2");
    expect(body).not.toContain("123456");
    expect(body).not.toContain("verify-token");
  });

  it("rejects a known email with 409 before hashing anything", async () => {
    const { deps, service } = setupUserSignup({
      authRepository: {
        findUserForLogin: jest.fn(),
        isEmailTaken: jest.fn().mockResolvedValue(true),
        signUpOrganizer: jest.fn(),
        signUpUser: jest.fn(),
      },
    });

    await expect(service.signUpUser(userInput)).rejects.toMatchObject({
      status: 409,
      code: "EMAIL_TAKEN",
    });
    expect(deps.hashPassword).not.toHaveBeenCalled();
  });

  it("returns 409 and sends nothing when a parallel signup took the email first", async () => {
    const { deps, service } = setupUserSignup({
      authRepository: {
        findUserForLogin: jest.fn(),
        isEmailTaken: jest.fn().mockResolvedValue(false),
        signUpOrganizer: jest.fn(),
        signUpUser: jest.fn().mockResolvedValue({ ok: false, reason: "EMAIL_TAKEN" }),
      },
    });

    await expect(service.signUpUser(userInput)).rejects.toBeInstanceOf(ConflictError);
    expect(deps.sendVerificationCodeEmail).not.toHaveBeenCalled();
  });

  it("still succeeds, with verificationEmailSent false, when the email fails", async () => {
    const { service } = setupUserSignup({
      sendVerificationCodeEmail: jest.fn().mockRejectedValue(new Error("Resend down")),
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await service.signUpUser(userInput);

    expect(result.verificationEmailSent).toBe(false);
  });
});

describe("userSignupBodySchema", () => {
  const valid = {
    firstName: " Ann ",
    lastName: "Attendee",
    email: " Ann@Example.TEST ",
    password: "Str0ng-Passw0rd!",
    confirmPassword: "Str0ng-Passw0rd!",
    phone: "555-123-4567",
  };

  it("uses the shared rules: trims names, lowercases the email", () => {
    const body = userSignupBodySchema.parse(valid);
    expect(body.firstName).toBe("Ann");
    expect(body.email).toBe("ann@example.test");
  });

  it("accepts a signup without a phone (user_profiles.phone is nullable)", () => {
    const body = userSignupBodySchema.parse({ ...valid, phone: undefined });
    expect(body.phone).toBeUndefined();
  });

  it("rejects a mismatch, a bad phone, a too-long city and a non-http avatar URL", () => {
    for (const bad of [
      { confirmPassword: "Other-Passw0rd!" },
      { phone: "abc" },
      { city: "x".repeat(101) },
      { avatarUrl: "javascript:alert(1)" },
    ]) {
      expect(userSignupBodySchema.safeParse({ ...valid, ...bad }).success).toBe(false);
    }
  });
});

describe("organizerSignupBodySchema", () => {
  const valid = {
    firstName: "  Olga ",
    lastName: "Organizer",
    email: " Olga@Acme.TEST ",
    password: "Str0ng-Passw0rd!",
    confirmPassword: "Str0ng-Passw0rd!",
    organizationName: "Acme Events",
  };

  it("trims names and lowercases the email", () => {
    const body = organizerSignupBodySchema.parse(valid);
    expect(body.firstName).toBe("Olga");
    expect(body.email).toBe("olga@acme.test");
  });

  it("rejects a weak password, a mismatch, a blank name and a non-http website", () => {
    for (const bad of [
      { password: "weakpass", confirmPassword: "weakpass" },
      { confirmPassword: "Other-Passw0rd!" },
      { firstName: "   " },
      { organizationWebsite: "javascript:alert(1)" },
    ]) {
      expect(organizerSignupBodySchema.safeParse({ ...valid, ...bad }).success).toBe(false);
    }
  });
});

describe("loginBodySchema", () => {
  it("trims and lowercases the email", () => {
    expect(
      loginBodySchema.parse({ email: "  Ada@Example.COM ", password: "x" }).email,
    ).toBe("ada@example.com");
  });

  it("rejects an invalid email and an empty password", () => {
    expect(
      loginBodySchema.safeParse({ email: "nope", password: "" }).success,
    ).toBe(false);
  });
});
