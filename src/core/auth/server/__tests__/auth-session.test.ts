import {
  createAuthSession,
  refreshAuthSession,
  resolveCurrentUser,
  revokeAuthSession,
} from "../auth-session";
import { authSessionRepository } from "../auth-session.repository";
import { permissionRepository } from "../permission.repository";
import { loadPermissions } from "../permissions.util";
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../tokens";

// Only the decisions in auth-session are under test, so the DB and the JWT library are faked
// (factory mocks: the real files, and the env they read, are never loaded).
jest.mock("../auth-session.repository", () => ({
  authSessionRepository: {
    insert: jest.fn(),
    findValidById: jest.fn(),
    findValidByRefreshTokenHash: jest.fn(),
    rotateRefreshToken: jest.fn(),
    revoke: jest.fn(),
    deleteByRefreshTokenHash: jest.fn(),
  },
}));
jest.mock("../permission.repository", () => ({
  permissionRepository: { findRoleByUserId: jest.fn() },
}));
jest.mock("../permissions.util", () => ({ loadPermissions: jest.fn() }));
jest.mock("../tokens", () => ({
  createAccessToken: jest.fn(),
  createRefreshToken: jest.fn(),
  hashToken: jest.fn(),
  verifyAccessToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
}));

const mockFindSession = jest.mocked(
  authSessionRepository.findValidByRefreshTokenHash,
);
const mockRotate = jest.mocked(authSessionRepository.rotateRefreshToken);
const mockRevoke = jest.mocked(authSessionRepository.revoke);
const mockFindRole = jest.mocked(permissionRepository.findRoleByUserId);
const mockVerifyRefreshToken = jest.mocked(verifyRefreshToken);
const mockCreateRefreshToken = jest.mocked(createRefreshToken);
const mockCreateAccessToken = jest.mocked(createAccessToken);
const mockHashToken = jest.mocked(hashToken);
const mockInsert = jest.mocked(authSessionRepository.insert);
const mockFindValidById = jest.mocked(authSessionRepository.findValidById);
const mockDeleteByHash = jest.mocked(
  authSessionRepository.deleteByRefreshTokenHash,
);
const mockVerifyAccessToken = jest.mocked(verifyAccessToken);
const mockLoadPermissions = jest.mocked(loadPermissions);

const userId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const sessionId = "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4";
const claims = { userId, sessionId };

const DAY_MS = 24 * 60 * 60 * 1000;
// The code reads the clock and the session's age: pin "now" and put the login a day before it.
const NOW = new Date("2026-10-21T10:00:00Z");
const activeSession = {
  sessionId,
  userId,
  status: "active" as const,
  createdAt: new Date(NOW.getTime() - DAY_MS),
};

const nextRefresh = {
  token: "new-refresh",
  tokenHash: "new-hash",
  // The sliding 7 days from NOW.
  expiresAt: new Date(NOW.getTime() + 7 * DAY_MS),
};
const nextAccess = {
  token: "new-access",
  expiresAt: new Date("2026-10-21T10:15:00Z"),
};

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.resetAllMocks();
  // The happy path; each test breaks exactly one step.
  mockVerifyRefreshToken.mockReturnValue(claims);
  mockHashToken.mockReturnValue("old-hash");
  mockFindSession.mockResolvedValue(activeSession);
  mockFindRole.mockResolvedValue("organizer");
  mockCreateRefreshToken.mockReturnValue(nextRefresh);
  mockCreateAccessToken.mockReturnValue(nextAccess);
  mockRotate.mockResolvedValue(true);
  mockRevoke.mockResolvedValue(undefined);
});

afterEach(() => jest.useRealTimers());

describe("refreshAuthSession", () => {
  it("rotates: stores the new refresh token's hash in place of the old one and returns a new pair", async () => {
    const tokens = await refreshAuthSession("old-refresh");

    expect(tokens).toEqual({
      accessToken: nextAccess,
      refreshToken: nextRefresh,
    });
    expect(mockRotate).toHaveBeenCalledWith(sessionId, "old-hash", {
      refreshTokenHash: "new-hash",
      expiresAt: nextRefresh.expiresAt,
    });
    // The new refresh token belongs to the same session.
    expect(mockCreateRefreshToken).toHaveBeenCalledWith(claims);
  });

  it("re-reads the role, so a role change reaches the new access token", async () => {
    mockFindRole.mockResolvedValue("admin");

    await refreshAuthSession("old-refresh");

    expect(mockCreateAccessToken).toHaveBeenCalledWith({
      ...claims,
      role: "admin",
    });
  });

  it("a token that is not a valid refresh JWT: null, and the DB is never asked", async () => {
    mockVerifyRefreshToken.mockReturnValue(null);

    expect(await refreshAuthSession("garbage")).toBeNull();
    expect(mockFindSession).not.toHaveBeenCalled();
    expect(mockRotate).not.toHaveBeenCalled();
    // A forged token proves nothing about a session: it must never revoke one.
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it("reuse: a genuine token that no session holds any more (already rotated) revokes ITS session", async () => {
    // The repository does return null here, but `const [row] = ...` makes TypeScript infer a
    // non-null type for it, hence the cast.
    mockFindSession.mockResolvedValue(null as never);

    expect(await refreshAuthSession("used-refresh")).toBeNull();

    // The session id comes from the verified token's claims.
    expect(mockRevoke).toHaveBeenCalledWith(sessionId);
    expect(mockRotate).not.toHaveBeenCalled();
    expect(mockCreateAccessToken).not.toHaveBeenCalled();
  });

  it("a session older than 30 days cannot refresh, however recently it was refreshed", async () => {
    mockFindSession.mockResolvedValue({
      ...activeSession,
      createdAt: new Date(NOW.getTime() - 30 * DAY_MS),
    });

    expect(await refreshAuthSession("old-refresh")).toBeNull();
    expect(mockRotate).not.toHaveBeenCalled();
    expect(mockCreateAccessToken).not.toHaveBeenCalled();
  });

  it("the sliding 7 days never run past the 30 day end: the stored expiry is clamped", async () => {
    // Day 28 of 30: a plain refresh would extend the session to day 35.
    const createdAt = new Date(NOW.getTime() - 28 * DAY_MS);
    mockFindSession.mockResolvedValue({ ...activeSession, createdAt });

    await refreshAuthSession("old-refresh");

    expect(mockRotate).toHaveBeenCalledWith(sessionId, "old-hash", {
      refreshTokenHash: "new-hash",
      expiresAt: new Date(createdAt.getTime() + 30 * DAY_MS),
    });
  });

  it("a session that does not match the token's own claims: null", async () => {
    mockFindSession.mockResolvedValue({
      ...activeSession,
      sessionId: "11111111-1111-4111-8111-111111111111",
    });
    expect(await refreshAuthSession("t")).toBeNull();

    mockFindSession.mockResolvedValue({
      ...activeSession,
      userId: "22222222-2222-4222-8222-222222222222",
    });
    expect(await refreshAuthSession("t")).toBeNull();
    expect(mockRotate).not.toHaveBeenCalled();
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it.each(["suspended", "pending"] as const)(
    "a %s account cannot refresh: null",
    async (status) => {
      mockFindSession.mockResolvedValue({ ...activeSession, status });

      expect(await refreshAuthSession("old-refresh")).toBeNull();
      expect(mockRotate).not.toHaveBeenCalled();
    },
  );

  it("a user who lost their role cannot refresh: null, nothing rotated", async () => {
    mockFindRole.mockResolvedValue(null);

    expect(await refreshAuthSession("old-refresh")).toBeNull();
    expect(mockRotate).not.toHaveBeenCalled();
  });

  it("when another request rotated first (lost race): null, and no access token is issued", async () => {
    mockRotate.mockResolvedValue(false);

    expect(await refreshAuthSession("old-refresh")).toBeNull();
    expect(mockCreateAccessToken).not.toHaveBeenCalled();
    // The token was still the current one when we read it: a database race, not a replay.
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it("a normal refresh never revokes the session", async () => {
    await refreshAuthSession("old-refresh");

    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it("one millisecond before the 30 day end it still refreshes, and expires exactly at the end", async () => {
    const createdAt = new Date(NOW.getTime() - 30 * DAY_MS + 1);
    mockFindSession.mockResolvedValue({ ...activeSession, createdAt });

    expect(await refreshAuthSession("old-refresh")).not.toBeNull();
    expect(mockRotate).toHaveBeenCalledWith(sessionId, "old-hash", {
      refreshTokenHash: "new-hash",
      expiresAt: new Date(createdAt.getTime() + 30 * DAY_MS),
    });
  });

  it("asks the database with the current time, so an expired session is not found", async () => {
    await refreshAuthSession("old-refresh");

    expect(mockFindSession).toHaveBeenCalledWith("old-hash", NOW);
  });

  it("a failing revoke is not swallowed: the request fails instead of pretending all is fine", async () => {
    mockFindSession.mockResolvedValue(null as never);
    mockRevoke.mockRejectedValue(new Error("DB down"));

    await expect(refreshAuthSession("used-refresh")).rejects.toThrow("DB down");
  });
});

describe("createAuthSession (login)", () => {
  const userAgent = "Mozilla/5.0";
  const firstRefresh = {
    token: "first-refresh",
    tokenHash: "first-hash",
    expiresAt: new Date(NOW.getTime() + 7 * DAY_MS),
  };

  beforeEach(() => {
    mockCreateRefreshToken.mockReturnValue(firstRefresh);
    mockInsert.mockResolvedValue(undefined);
  });

  it("stores one session row with the refresh token's HASH, and both tokens share its id", async () => {
    const result = await createAuthSession(userId, userAgent);

    expect(result).toEqual({
      tokens: { accessToken: nextAccess, refreshToken: firstRefresh },
      role: "organizer",
    });
    const row = mockInsert.mock.calls[0][0];
    expect(row).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      userId,
      refreshTokenHash: "first-hash",
      expiresAt: firstRefresh.expiresAt,
      userAgent,
    });
    // The row id is the session id inside both tokens.
    expect(mockCreateRefreshToken).toHaveBeenCalledWith({
      userId,
      sessionId: row.id,
    });
    expect(mockCreateAccessToken).toHaveBeenCalledWith({
      userId,
      sessionId: row.id,
      role: "organizer",
    });
  });

  it("never stores the raw refresh token", async () => {
    await createAuthSession(userId, userAgent);

    expect(JSON.stringify(mockInsert.mock.calls)).not.toContain(
      "first-refresh",
    );
  });

  it("gives every login its own session id", async () => {
    await createAuthSession(userId, userAgent);
    await createAuthSession(userId, userAgent);

    const [first, second] = mockInsert.mock.calls.map(([row]) => row.id);
    expect(first).not.toBe(second);
  });

  it("a user with no role gets no session and no tokens", async () => {
    mockFindRole.mockResolvedValue(null);

    expect(await createAuthSession(userId, userAgent)).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockCreateRefreshToken).not.toHaveBeenCalled();
    expect(mockCreateAccessToken).not.toHaveBeenCalled();
  });

  it("keeps a missing user agent as null", async () => {
    await createAuthSession(userId, null);

    expect(mockInsert.mock.calls[0][0].userAgent).toBeNull();
  });
});

describe("revokeAuthSession (logout)", () => {
  it("deletes the session found by the HASH of the refresh cookie", async () => {
    mockHashToken.mockReturnValue("cookie-hash");
    mockDeleteByHash.mockResolvedValue(undefined);

    await revokeAuthSession("cookie-refresh");

    expect(mockHashToken).toHaveBeenCalledWith("cookie-refresh");
    expect(mockDeleteByHash).toHaveBeenCalledWith("cookie-hash");
  });
});

describe("resolveCurrentUser (every protected request)", () => {
  const accessClaims = { userId, sessionId, role: "organizer" as const };
  const liveSession = {
    userId,
    status: "active" as const,
    firstName: "Ananya",
    lastName: "Rao",
    email: "ananya@example.com",
  };
  const permissions = new Set(["EVENT_CREATE"]);

  beforeEach(() => {
    mockVerifyAccessToken.mockReturnValue(accessClaims);
    mockFindValidById.mockResolvedValue(liveSession);
    mockLoadPermissions.mockResolvedValue(permissions);
  });

  it("returns the user, with the role's permissions and the names from the database", async () => {
    expect(await resolveCurrentUser("access")).toEqual({
      id: userId,
      sessionId,
      role: "organizer",
      permissions,
      firstName: "Ananya",
      lastName: "Rao",
      email: "ananya@example.com",
    });
    expect(mockLoadPermissions).toHaveBeenCalledWith("organizer");
    expect(mockFindValidById).toHaveBeenCalledWith(sessionId, NOW);
  });

  it("an invalid access token: null, and the database is never asked", async () => {
    mockVerifyAccessToken.mockReturnValue(null);

    expect(await resolveCurrentUser("garbage")).toBeNull();
    expect(mockFindValidById).not.toHaveBeenCalled();
  });

  it("a revoked, expired or logged-out session: null at once, not when the access token expires", async () => {
    // This is what makes revoke-on-reuse stop an attacker's still-valid access token.
    mockFindValidById.mockResolvedValue(null as never);

    expect(await resolveCurrentUser("access")).toBeNull();
    expect(mockLoadPermissions).not.toHaveBeenCalled();
  });

  it("a session that belongs to another user than the token says: null", async () => {
    mockFindValidById.mockResolvedValue({
      ...liveSession,
      userId: "22222222-2222-4222-8222-222222222222",
    });

    expect(await resolveCurrentUser("access")).toBeNull();
  });

  it.each(["suspended", "pending"] as const)(
    "a %s account is rejected on its very next request",
    async (status) => {
      mockFindValidById.mockResolvedValue({ ...liveSession, status });

      expect(await resolveCurrentUser("access")).toBeNull();
    },
  );
});
