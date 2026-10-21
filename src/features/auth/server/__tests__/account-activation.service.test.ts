import { ValidationError } from "../../../../core/http/errors";
import {
  accountSetupBodySchema,
  verifyEmailBodySchema,
} from "../../schemas/auth.schemas";
import {
  createAccountActivationService,
  createAccountSetupToken,
  type AccountActivationServiceDeps,
} from "../account-activation.service";

// The repository, argon2 and the email feature are replaced by fakes; tokens.ts runs for
// real (pure crypto), but it imports env for the JWT secret, so that is stubbed.
jest.mock("../account-activation.repository", () => ({}));
jest.mock("../../../../core/auth/server/password", () => ({}));
jest.mock("../../../email/server", () => ({}));
jest.mock("../../../../config/env", () => ({
  env: { AUTH_JWT_SECRET: "test-secret-that-is-at-least-32-characters" },
}));

const owner = {
  userId: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
  email: "olga@acme.test",
};

function setup(
  results: {
    findValidToken?: typeof owner | null;
    codeOk?: boolean;
    completeSetup?: boolean;
    verifyEmail?: boolean;
  } = {},
) {
  const deps = {
    accountActivationRepository: {
      findValidToken: jest
        .fn()
        .mockResolvedValue(
          results.findValidToken === undefined ? owner : results.findValidToken,
        ),
      completeSetup: jest.fn().mockResolvedValue(results.completeSetup ?? true),
      verifyEmail: jest.fn().mockResolvedValue(results.verifyEmail ?? true),
    },
    hashPassword: jest.fn().mockResolvedValue("$argon2id$new-hash"),
    hashEmailOtp: jest.fn().mockReturnValue("hashed-otp"),
    emailOtpStore: {
      verify: jest.fn().mockResolvedValue(results.codeOk ?? true),
    },
  } satisfies AccountActivationServiceDeps;
  return { deps, service: createAccountActivationService(deps) };
}

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

describe("accountActivationService.completeAccountSetup", () => {
  const body = {
    token: "raw-token",
    password: "a-new-password",
    confirmPassword: "a-new-password",
  };

  it("passes the token HASH and the password HASH to the repository, never raw values", async () => {
    const { deps, service } = setup();

    await service.completeAccountSetup(body);

    const call =
      deps.accountActivationRepository.completeSetup.mock.calls[0][0];
    expect(call.passwordHash).toBe("$argon2id$new-hash");
    expect(call.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(call.tokenHash).not.toBe("raw-token");
  });

  it("answers an unknown, used or expired link with one 400", async () => {
    const { service } = setup({ completeSetup: false });

    const error = await service
      .completeAccountSetup(body)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      status: 400,
      message: "This link is invalid or has expired",
    });
  });
});

describe("accountActivationService.verifyEmail", () => {
  const body = { token: "raw-verify-token", otp: "123456" };

  it("token valid → code checked in Redis for the token's email → token consumed", async () => {
    const { deps, service } = setup();

    await service.verifyEmail(body);

    // 1. The DB is asked with the token's HASH, never the raw token.
    const lookup =
      deps.accountActivationRepository.findValidToken.mock.calls[0][0];
    expect(lookup.type).toBe("email_verify");
    expect(lookup.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(lookup.tokenHash).not.toBe("raw-verify-token");
    // 2. The code is hashed with the email FROM THE TOKEN and checked in Redis.
    expect(deps.hashEmailOtp).toHaveBeenCalledWith("olga@acme.test", "123456");
    expect(deps.emailOtpStore.verify).toHaveBeenCalledWith(
      "olga@acme.test",
      "hashed-otp",
    );
    // 3. The same token hash is consumed (activate + invalidate happen in the repository).
    const consume =
      deps.accountActivationRepository.verifyEmail.mock.calls[0][0];
    expect(consume.tokenHash).toBe(lookup.tokenHash);
  });

  it("rejects an unknown, used or expired link without checking the code", async () => {
    const { deps, service } = setup({ findValidToken: null });

    const error = await service.verifyEmail(body).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      status: 400,
      details: {
        fieldErrors: { token: ["This link is invalid or has expired"] },
      },
    });
    expect(deps.emailOtpStore.verify).not.toHaveBeenCalled();
    expect(deps.accountActivationRepository.verifyEmail).not.toHaveBeenCalled();
  });

  it("rejects a wrong code on the otp field and does NOT consume the link", async () => {
    const { deps, service } = setup({ codeOk: false });

    const error = await service.verifyEmail(body).catch((e: unknown) => e);

    expect(error).toMatchObject({
      status: 400,
      details: {
        fieldErrors: { otp: ["This code is invalid or has expired"] },
      },
    });
    // The link stays usable for the next (correct) try.
    expect(deps.accountActivationRepository.verifyEmail).not.toHaveBeenCalled();
  });

  it("rejects when the link was used or expired between the check and the consume", async () => {
    const { service } = setup({ verifyEmail: false });

    await expect(service.verifyEmail(body)).rejects.toMatchObject({
      details: {
        fieldErrors: { token: ["This link is invalid or has expired"] },
      },
    });
  });
});

describe("accountSetupBodySchema", () => {
  it("rejects mismatched passwords on confirmPassword", () => {
    const result = accountSetupBodySchema.safeParse({
      token: "t",
      // Both meet the password policy, so the only failure is the mismatch.
      password: "Password-one1",
      confirmPassword: "Password-two1",
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

describe("verifyEmailBodySchema", () => {
  it("needs the link token and trims the code", () => {
    expect(
      verifyEmailBodySchema.parse({ token: "t", otp: " 123456 " }).otp,
    ).toBe("123456");
    expect(
      verifyEmailBodySchema.safeParse({ token: "", otp: "123456" }).success,
    ).toBe(false);
  });

  it("accepts exactly 6 digits", () => {
    for (const otp of ["12345", "1234567", "12a456", ""]) {
      expect(verifyEmailBodySchema.safeParse({ token: "t", otp }).success).toBe(
        false,
      );
    }
  });
});
