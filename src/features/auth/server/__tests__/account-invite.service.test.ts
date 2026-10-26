import {
  ConflictError,
  NotFoundError,
  RateLimitError,
} from "../../../../core/http/errors";
import { resendInviteResponseSchema } from "../../schemas/auth.schemas";
import {
  createAccountInviteService,
  type AccountInviteServiceDeps,
} from "../account-invite.service";

// The repository, argon2 and the email feature are never loaded; env is stubbed.
jest.mock("../account-activation.repository", () => ({}));
jest.mock("../../../../core/auth/server/password", () => ({}));
jest.mock("../../../email/server", () => ({}));
jest.mock("../../../../config/env", () => ({
  env: { AUTH_JWT_SECRET: "test-secret-that-is-at-least-32-characters" },
}));

const userId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const now = new Date("2026-10-25T10:00:00.000Z");
const setupToken = {
  token: "raw-token/with+chars",
  tokenHash: "hashed-token",
  expiresAt: new Date("2026-10-26T10:00:00.000Z"),
};
const invitee = { id: userId, email: "ankit@speaker.test", firstName: "Ankit" };

function setup(overrides: Partial<AccountInviteServiceDeps> = {}) {
  const deps = {
    accountActivationRepository: {
      reissueSetupToken: jest
        .fn()
        .mockResolvedValue({ ok: true, user: invitee }),
    },
    createAccountSetupToken: jest.fn().mockReturnValue(setupToken),
    enqueueAccountSetupEmail: jest.fn().mockResolvedValue(undefined),
    appUrl: "http://localhost:3000",
    cooldownSeconds: 60,
    ...overrides,
  } satisfies AccountInviteServiceDeps;
  return { deps, service: createAccountInviteService(deps) };
}

function repoAnswer(answer: unknown) {
  return { reissueSetupToken: jest.fn().mockResolvedValue(answer) };
}

describe("accountInviteService.resendAccountSetup", () => {
  it("swaps in a new link (only its hash is stored) with the cooldown", async () => {
    const { deps, service } = setup();

    await service.resendAccountSetup(userId, now);

    expect(
      deps.accountActivationRepository.reissueSetupToken,
    ).toHaveBeenCalledWith({
      userId,
      setupToken: {
        tokenHash: "hashed-token",
        expiresAt: setupToken.expiresAt,
      },
      now,
      cooldownMs: 60_000,
    });
  });

  it("emails the new set-password link and says when it expires, without the link itself", async () => {
    const { deps, service } = setup();

    const result = await service.resendAccountSetup(userId, now);

    expect(deps.enqueueAccountSetupEmail).toHaveBeenCalledWith({
      to: "ankit@speaker.test",
      firstName: "Ankit",
      passwordSetupUrl:
        "http://localhost:3000/set-password?token=raw-token%2Fwith%2Bchars",
      loginUrl: "http://localhost:3000/login",
      expiresInHours: 24,
    });
    expect(result).toEqual({
      setupEmailQueued: true,
      expiresAt: "2026-10-26T10:00:00.000Z",
    });
    expect(resendInviteResponseSchema.safeParse(result).success).toBe(true);
    expect(JSON.stringify(result)).not.toContain("raw-token");
  });

  it("returns 409 ACCOUNT_ALREADY_ACTIVE and sends nothing for an active account", async () => {
    const { deps, service } = setup({
      accountActivationRepository: repoAnswer({
        ok: false,
        reason: "ALREADY_ACTIVE",
      }),
    });

    const error = await service
      .resendAccountSetup(userId, now)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      status: 409,
      code: "ACCOUNT_ALREADY_ACTIVE",
    });
    expect(deps.enqueueAccountSetupEmail).not.toHaveBeenCalled();
  });

  it("returns 409 ACCOUNT_SUSPENDED for a suspended account", async () => {
    const { service } = setup({
      accountActivationRepository: repoAnswer({
        ok: false,
        reason: "SUSPENDED",
      }),
    });

    await expect(service.resendAccountSetup(userId, now)).rejects.toMatchObject(
      {
        status: 409,
        code: "ACCOUNT_SUSPENDED",
      },
    );
  });

  it("returns 429 with the wait time inside the cooldown", async () => {
    const { deps, service } = setup({
      accountActivationRepository: repoAnswer({
        ok: false,
        reason: "TOO_SOON",
        retryAfterSeconds: 42,
      }),
    });

    const error = await service
      .resendAccountSetup(userId, now)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toMatchObject({ status: 429 });
    expect((error as RateLimitError).message).toContain("42 seconds");
    expect(deps.enqueueAccountSetupEmail).not.toHaveBeenCalled();
  });

  it("returns 404 when the account does not exist", async () => {
    const { service } = setup({
      accountActivationRepository: repoAnswer({
        ok: false,
        reason: "NOT_FOUND",
      }),
    });

    await expect(
      service.resendAccountSetup(userId, now),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keeps the new link and reports it when the email cannot be queued", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { service } = setup({
      enqueueAccountSetupEmail: jest
        .fn()
        .mockRejectedValue(new Error("Redis down")),
    });

    const result = await service.resendAccountSetup(userId, now);

    expect(result.setupEmailQueued).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain("raw-token");
    log.mockRestore();
  });
});
