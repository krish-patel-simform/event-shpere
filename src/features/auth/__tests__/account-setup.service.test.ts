import { ValidationError } from "../../../core/http/errors";
import { accountSetupBodySchema } from "../schemas/auth.schemas";
import {
  createAccountSetupService,
  createAccountSetupToken,
} from "../server/account-setup.service";

// The repository and argon2 are replaced by fakes; tokens.ts runs for real (pure crypto),
// but it imports env for the JWT secret, so that is stubbed.
jest.mock("../server/account-setup.repository", () => ({}));
jest.mock("../../../core/auth/server/password", () => ({}));
jest.mock("../../../config/env", () => ({
  env: { AUTH_JWT_SECRET: "test-secret-that-is-at-least-32-characters" },
}));

describe("createAccountSetupToken", () => {
  it("returns a random token, its hash, and an expiry 24 hours ahead", () => {
    const now = new Date("2026-10-17T10:00:00.000Z");

    const a = createAccountSetupToken(now);
    const b = createAccountSetupToken(now);

    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(a.token);
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(a.expiresAt.toISOString()).toBe("2026-10-18T10:00:00.000Z");
  });
});

describe("accountSetupService.completeAccountSetup", () => {
  const body = {
    token: "raw-token",
    password: "a-new-password",
    confirmPassword: "a-new-password",
  };

  function setup(completeSetupResult: boolean) {
    const deps = {
      accountSetupRepository: {
        completeSetup: jest.fn().mockResolvedValue(completeSetupResult),
      },
      hashPassword: jest.fn().mockResolvedValue("$argon2id$new-hash"),
    };
    return { deps, service: createAccountSetupService(deps) };
  }

  it("passes the token HASH and the password HASH to the repository, never raw values", async () => {
    const { deps, service } = setup(true);

    await service.completeAccountSetup(body);

    const call = deps.accountSetupRepository.completeSetup.mock.calls[0][0];
    expect(call.passwordHash).toBe("$argon2id$new-hash");
    expect(call.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(call.tokenHash).not.toBe("raw-token");
  });

  it("answers an unknown, used or expired link with one 400", async () => {
    const { service } = setup(false);

    const error = await service.completeAccountSetup(body).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      status: 400,
      message: "This link is invalid or has expired",
    });
  });
});

describe("accountSetupBodySchema", () => {
  it("rejects mismatched passwords on confirmPassword", () => {
    const result = accountSetupBodySchema.safeParse({
      token: "t",
      password: "password-one",
      confirmPassword: "password-two",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["confirmPassword"]);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(
      accountSetupBodySchema.safeParse({
        token: "t",
        password: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
  });
});
