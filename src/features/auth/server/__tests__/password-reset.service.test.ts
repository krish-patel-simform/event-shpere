import { hashToken } from "../../../../core/auth/server/tokens";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
} from "../../../../core/http/errors";
import {
  createPasswordResetService,
  type PasswordResetServiceDeps,
} from "../password-reset.service";

// The repository and the email feature are replaced by fakes; tokens.ts runs for real (pure
// crypto) but imports env, which is stubbed. The service module also reads env.APP_URL.
jest.mock("../password-reset.repository", () => ({}));
jest.mock("../../../../core/auth/server/password", () => ({}));
jest.mock("../../../email/server", () => ({}));
jest.mock("../../../../config/env", () => ({
  env: {
    AUTH_JWT_SECRET: "test-secret-that-is-at-least-32-characters",
    APP_URL: "https://app.test",
  },
}));

const user = {
  id: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
  email: "olga@acme.test",
  firstName: "Olga",
  // Widened so a test can swap in "admin" or no role at all.
  role: "user" as "user" | "admin" | null,
};
const now = new Date("2026-10-20T10:00:00Z");

const owner = {
  userId: user.id,
  passwordHash: "stored-hash-of-the-current-password",
};

// The account an admin sends a link to: any status, so the service can say why it refuses.
const target = {
  ...user,
  status: "active" as "active" | "pending" | "suspended",
};

function setup(
  results: {
    user?: typeof user | null;
    /** What findUserById finds for an admin's "send a reset link": an account, or null. */
    target?: typeof target | null;
    /** When that account's newest link was made; null = never. */
    lastLinkAt?: Date | null;
    sendFails?: boolean;
    /** What findValidResetToken finds: the link's owner, or null for a bad link. */
    owner?: typeof owner | { userId: string; passwordHash: null } | null;
    /** verifyPassword's answer: true = the new password equals the current one. */
    samePassword?: boolean;
    /** resetPassword's answer: false = the link was used up in the meantime. */
    resetDone?: boolean;
  } = {},
) {
  const deps = {
    passwordResetRepository: {
      findActiveUserByEmail: jest
        .fn()
        .mockResolvedValue(results.user === undefined ? user : results.user),
      findUserById: jest
        .fn()
        .mockResolvedValue(
          results.target === undefined ? target : results.target,
        ),
      findLastResetTokenCreatedAt: jest
        .fn()
        .mockResolvedValue(results.lastLinkAt ?? null),
      createResetToken: jest.fn().mockResolvedValue(undefined),
      findValidResetToken: jest
        .fn()
        .mockResolvedValue(results.owner === undefined ? owner : results.owner),
      resetPassword: jest.fn().mockResolvedValue(results.resetDone ?? true),
    },
    hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
    verifyPassword: jest.fn().mockResolvedValue(results.samePassword ?? false),
    sendPasswordResetEmail: results.sendFails
      ? jest.fn().mockRejectedValue(new Error("Resend is down"))
      : jest.fn().mockResolvedValue(undefined),
    tokenTtlMinutes: 10,
    adminCooldownSeconds: 60,
    appUrl: "https://app.test",
  } satisfies PasswordResetServiceDeps;
  return { deps, service: createPasswordResetService(deps) };
}

/** The raw token is only in the email link: read it from there, like the user's browser would. */
function tokenFromEmail(sendMock: jest.Mock): string {
  const { resetUrl } = sendMock.mock.calls[0][0] as { resetUrl: string };
  const token = new URL(resetUrl).searchParams.get("token");
  if (!token) throw new Error("no token in the link");
  return token;
}

describe("passwordResetService.requestReset", () => {
  it("does nothing for an email without an active account (same answer, no token, no email)", async () => {
    const { deps, service } = setup({ user: null });

    await expect(
      service.requestReset({ email: "nobody@acme.test" }, now),
    ).resolves.toBeUndefined();

    expect(
      deps.passwordResetRepository.createResetToken,
    ).not.toHaveBeenCalled();
    expect(deps.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("rejects an admin account with a validation error (no token, no email)", async () => {
    const { deps, service } = setup({ user: { ...user, role: "admin" } });

    await expect(
      service.requestReset({ email: user.email }, now),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(
      deps.passwordResetRepository.createResetToken,
    ).not.toHaveBeenCalled();
    expect(deps.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("still sends a link to an account that has no role row", async () => {
    const { deps, service } = setup({ user: { ...user, role: null } });

    await service.requestReset({ email: user.email }, now);

    expect(deps.passwordResetRepository.createResetToken).toHaveBeenCalledTimes(
      1,
    );
    expect(deps.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("looks the account up by the email it was given", async () => {
    const { deps, service } = setup();
    await service.requestReset({ email: "olga@acme.test" }, now);
    expect(
      deps.passwordResetRepository.findActiveUserByEmail,
    ).toHaveBeenCalledWith("olga@acme.test");
  });

  it("stores only the HASH of the token; the raw token is only in the email link", async () => {
    const { deps, service } = setup();
    await service.requestReset({ email: user.email }, now);

    const stored =
      deps.passwordResetRepository.createResetToken.mock.calls[0][0];
    const raw = tokenFromEmail(deps.sendPasswordResetEmail);

    expect(stored.tokenHash).toBe(hashToken(raw));
    expect(stored.tokenHash).not.toBe(raw);
    expect(JSON.stringify(stored)).not.toContain(raw);
    expect(raw.length).toBeGreaterThanOrEqual(40); // 32 random bytes, base64url
  });

  it("sets the expiry from the configured minutes", async () => {
    const { deps, service } = setup();
    await service.requestReset({ email: user.email }, now);

    const stored =
      deps.passwordResetRepository.createResetToken.mock.calls[0][0];
    expect(stored.userId).toBe(user.id);
    expect(stored.now).toEqual(now);
    expect(stored.expiresAt).toEqual(new Date("2026-10-20T10:10:00Z"));
  });

  it("emails the account's address a link to the reset page", async () => {
    const { deps, service } = setup();
    await service.requestReset({ email: user.email }, now);

    expect(deps.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const mail = deps.sendPasswordResetEmail.mock.calls[0][0];
    expect(mail.to).toBe(user.email);
    expect(mail.firstName).toBe("Olga");
    expect(mail.expiresInMinutes).toBe(10);
    expect(
      mail.resetUrl.startsWith("https://app.test/reset-password?token="),
    ).toBe(true);
  });

  it("every request makes a different token", async () => {
    const { deps, service } = setup();
    await service.requestReset({ email: user.email }, now);
    await service.requestReset({ email: user.email }, now);

    const [first, second] = deps.sendPasswordResetEmail.mock.calls.map(
      (call) => (call[0] as { resetUrl: string }).resetUrl,
    );
    expect(first).not.toBe(second);
  });

  it("sends the email only AFTER the token is stored", async () => {
    const { deps, service } = setup();
    await service.requestReset({ email: user.email }, now);

    const stored =
      deps.passwordResetRepository.createResetToken.mock.invocationCallOrder[0];
    const sent = deps.sendPasswordResetEmail.mock.invocationCallOrder[0];
    expect(stored).toBeLessThan(sent);
  });

  it("still resolves when sending fails, and never logs the link or the token", async () => {
    const { deps, service } = setup({ sendFails: true });
    const log = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      service.requestReset({ email: user.email }, now),
    ).resolves.toBeUndefined();

    // The send failed, but the service still built the link: read the token it tried to send.
    const raw = tokenFromEmail(deps.sendPasswordResetEmail);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("Resend is down");
    expect(logged).not.toContain("reset-password");
    expect(logged).not.toContain(raw);
    log.mockRestore();
  });

  it("does not send an email when storing the token fails", async () => {
    const { deps, service } = setup();
    deps.passwordResetRepository.createResetToken.mockRejectedValue(
      new Error("db down"),
    );

    await expect(
      service.requestReset({ email: user.email }, now),
    ).rejects.toThrow("db down");
    expect(deps.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe("passwordResetService.sendResetLinkToUser (an admin sends the link)", () => {
  afterEach(() => jest.restoreAllMocks());

  const expectNothingSent = (deps: ReturnType<typeof setup>["deps"]) => {
    expect(
      deps.passwordResetRepository.createResetToken,
    ).not.toHaveBeenCalled();
    expect(deps.sendPasswordResetEmail).not.toHaveBeenCalled();
  };

  it("looks the account up by the id it was given", async () => {
    const { deps, service } = setup();

    await service.sendResetLinkToUser(user.id, now);

    expect(deps.passwordResetRepository.findUserById).toHaveBeenCalledWith(
      user.id,
    );
  });

  it("404 for an unknown user: no token, no email", async () => {
    const { deps, service } = setup({ target: null });

    await expect(
      service.sendResetLinkToUser(user.id, now),
    ).rejects.toBeInstanceOf(NotFoundError);

    expectNothingSent(deps);
  });

  it('403 for an administrator, like "forgot password" (no token, no email)', async () => {
    const { deps, service } = setup({ target: { ...target, role: "admin" } });

    await expect(
      service.sendResetLinkToUser(user.id, now),
    ).rejects.toMatchObject({
      constructor: ForbiddenError,
      code: "CANNOT_RESET_ADMIN",
      status: 403,
    });

    expectNothingSent(deps);
  });

  it("409 for a pending account: it has no password yet, so it needs the set-password invite", async () => {
    const { deps, service } = setup({
      target: { ...target, status: "pending" },
    });

    await expect(
      service.sendResetLinkToUser(user.id, now),
    ).rejects.toMatchObject({
      constructor: ConflictError,
      code: "ACCOUNT_PENDING",
    });

    expectNothingSent(deps);
  });

  it("409 for a suspended account (no token, no email)", async () => {
    const { deps, service } = setup({
      target: { ...target, status: "suspended" },
    });

    await expect(
      service.sendResetLinkToUser(user.id, now),
    ).rejects.toMatchObject({
      constructor: ConflictError,
      code: "ACCOUNT_SUSPENDED",
    });

    expectNothingSent(deps);
  });

  it("still sends a link to an active account that has no role row", async () => {
    const { deps, service } = setup({ target: { ...target, role: null } });

    await service.sendResetLinkToUser(user.id, now);

    expect(deps.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('makes the same kind of token as "forgot password": only the hash is stored, with the same expiry', async () => {
    const { deps, service } = setup();

    await service.sendResetLinkToUser(user.id, now);

    const stored =
      deps.passwordResetRepository.createResetToken.mock.calls[0][0];
    const raw = tokenFromEmail(deps.sendPasswordResetEmail);
    expect(stored.userId).toBe(user.id);
    expect(stored.tokenHash).toBe(hashToken(raw));
    expect(stored.tokenHash).not.toBe(raw);
    expect(stored.expiresAt).toEqual(new Date("2026-10-20T10:10:00Z"));
    expect(stored.now).toEqual(now);
  });

  it("sends the same email to the account's address, with the wording for an admin's link", async () => {
    const { deps, service } = setup();

    await service.sendResetLinkToUser(user.id, now);

    expect(deps.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const mail = deps.sendPasswordResetEmail.mock.calls[0][0];
    expect(mail.to).toBe(user.email);
    expect(mail.firstName).toBe("Olga");
    expect(mail.expiresInMinutes).toBe(10);
    expect(mail.sentByAdmin).toBe(true);
    expect(
      mail.resetUrl.startsWith("https://app.test/reset-password?token="),
    ).toBe(true);
  });

  it("answers with the expiry only, never the link or the token", async () => {
    const { deps, service } = setup();

    const result = await service.sendResetLinkToUser(user.id, now);

    expect(result).toEqual({ expiresAt: "2026-10-20T10:10:00.000Z" });
    expect(JSON.stringify(result)).not.toContain(
      tokenFromEmail(deps.sendPasswordResetEmail),
    );
  });

  it("429 when a link was made less than a minute ago, and says how long to wait", async () => {
    const { deps, service } = setup({
      lastLinkAt: new Date("2026-10-20T09:59:30Z"),
    });

    const attempt = service.sendResetLinkToUser(user.id, now);

    await expect(attempt).rejects.toBeInstanceOf(RateLimitError);
    await expect(attempt).rejects.toThrow("30 seconds");
    expectNothingSent(deps);
  });

  it("sends again once the minute is over (also exactly at 60 seconds)", async () => {
    const exactly = setup({ lastLinkAt: new Date("2026-10-20T09:59:00Z") });
    await expect(
      exactly.service.sendResetLinkToUser(user.id, now),
    ).resolves.toBeDefined();

    const earlier = setup({ lastLinkAt: new Date("2026-10-20T09:00:00Z") });
    await expect(
      earlier.service.sendResetLinkToUser(user.id, now),
    ).resolves.toBeDefined();
  });

  it("503 when the email cannot be sent, so the admin knows; the log has no link in it", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const { deps, service } = setup({ sendFails: true });

    await expect(
      service.sendResetLinkToUser(user.id, now),
    ).rejects.toMatchObject({
      constructor: ServiceUnavailableError,
      code: "EMAIL_NOT_SENT",
      status: 503,
    });

    // The link was saved (and is useless to anyone); the admin can send again after the minute.
    expect(deps.passwordResetRepository.createResetToken).toHaveBeenCalledTimes(
      1,
    );
    expect(log).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(log.mock.calls);
    const raw = new URL(
      (deps.sendPasswordResetEmail.mock.calls[0][0] as { resetUrl: string })
        .resetUrl,
    ).searchParams.get("token");
    expect(logged).toContain("Resend is down");
    expect(logged).not.toContain(raw);
    expect(logged).not.toContain("reset-password?token");
  });

  it('does not change "forgot password": that email has no admin wording', async () => {
    const { deps, service } = setup();

    await service.requestReset({ email: user.email }, now);

    expect(deps.sendPasswordResetEmail.mock.calls[0][0]).not.toHaveProperty(
      "sentByAdmin",
    );
  });
});

describe("passwordResetService.resetPassword", () => {
  const input = {
    token: "raw-token-from-the-email-link",
    password: "NewSecret1!",
    confirmPassword: "NewSecret1!",
  };
  const INVALID_LINK = "This link is invalid or has expired";
  const SAME_PASSWORD = "Choose a password different from your current one";

  it("looks the link up by the HASH of the token, never the raw token", async () => {
    const { deps, service } = setup();
    await service.resetPassword(input, now);

    const lookup =
      deps.passwordResetRepository.findValidResetToken.mock.calls[0][0];
    expect(lookup).toEqual({ tokenHash: hashToken(input.token), now });
    expect(JSON.stringify(lookup)).not.toContain(input.token);
  });

  it("rejects an unknown, used or expired link with fieldErrors.token, and touches nothing", async () => {
    const { deps, service } = setup({ owner: null });

    await expect(service.resetPassword(input, now)).rejects.toMatchObject({
      status: 400,
      details: { fieldErrors: { token: [INVALID_LINK] } },
    });

    expect(deps.verifyPassword).not.toHaveBeenCalled();
    expect(deps.passwordResetRepository.resetPassword).not.toHaveBeenCalled();
  });

  it("checks the plain new password against the CURRENT hash", async () => {
    const { deps, service } = setup();
    await service.resetPassword(input, now);

    expect(deps.verifyPassword).toHaveBeenCalledWith(
      owner.passwordHash,
      input.password,
    );
  });

  it("rejects the same password with fieldErrors.password, and does NOT use up the link", async () => {
    const { deps, service } = setup({ samePassword: true });

    await expect(service.resetPassword(input, now)).rejects.toMatchObject({
      status: 400,
      details: { fieldErrors: { password: [SAME_PASSWORD] } },
    });

    // Nothing was hashed or saved, so the same link still works for another password.
    expect(deps.hashPassword).not.toHaveBeenCalled();
    expect(deps.passwordResetRepository.resetPassword).not.toHaveBeenCalled();
  });

  it("saves the HASH of a different password, never the plain one", async () => {
    const { deps, service } = setup();
    await expect(service.resetPassword(input, now)).resolves.toBeUndefined();

    const call = deps.passwordResetRepository.resetPassword.mock.calls[0][0];
    expect(call).toEqual({
      tokenHash: hashToken(input.token),
      newPasswordHash: "hashed:NewSecret1!",
      now,
    });
    expect(JSON.stringify(call)).not.toContain(`"${input.password}"`);
  });

  it("skips the same-password check for an account that has no password yet", async () => {
    const { deps, service } = setup({
      owner: { userId: user.id, passwordHash: null },
    });

    await expect(service.resetPassword(input, now)).resolves.toBeUndefined();

    expect(deps.verifyPassword).not.toHaveBeenCalled();
    expect(deps.passwordResetRepository.resetPassword).toHaveBeenCalledTimes(1);
  });

  it("rejects with fieldErrors.token when the link was used up before the save", async () => {
    const { service } = setup({ resetDone: false });

    await expect(service.resetPassword(input, now)).rejects.toMatchObject({
      status: 400,
      details: { fieldErrors: { token: [INVALID_LINK] } },
    });
  });

  it("never puts a password or a hash in an error", async () => {
    const { service } = setup({ samePassword: true });

    const error = await service
      .resetPassword(input, now)
      .catch((e: unknown) => e);

    const text = JSON.stringify(error, Object.getOwnPropertyNames(error));
    expect(text).not.toContain(input.password);
    expect(text).not.toContain(owner.passwordHash);
  });
});
