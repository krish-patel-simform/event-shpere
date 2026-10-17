import { ForbiddenError, UnauthorizedError } from "../../../core/http/errors";
import { loginBodySchema } from "../schemas/auth.schemas";
import { createAuthService, type AuthServiceDeps } from "../server/auth.service";

// Empty factories: the real modules (DB client, env, jsonwebtoken) are never loaded.
// The service under test gets fakes through createAuthService instead.
jest.mock("../../../core/auth/server/auth-session", () => ({}));
jest.mock("../../../core/auth/server/password", () => ({}));
jest.mock("../server/auth.repository", () => ({}));

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
    authRepository: { findUserForLogin: jest.fn().mockResolvedValue(user) },
    hashPassword: jest.fn().mockResolvedValue("$argon2id$dummy-hash"),
    verifyPassword: jest.fn().mockResolvedValue(true),
    createAuthSession: jest.fn().mockResolvedValue({ tokens, role: "admin" }),
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
