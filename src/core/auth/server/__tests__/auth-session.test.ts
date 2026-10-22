import { refreshAuthSession } from "../auth-session";
import { authSessionRepository } from "../auth-session.repository";
import { permissionRepository } from "../permission.repository";
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  verifyRefreshToken,
} from "../tokens";

// Only the decisions in refreshAuthSession are under test, so the DB and the JWT library are
// faked (factory mocks: the real files, and the env they read, are never loaded).
jest.mock("../auth-session.repository", () => ({
  authSessionRepository: {
    findValidByRefreshTokenHash: jest.fn(),
    rotateRefreshToken: jest.fn(),
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
const mockFindRole = jest.mocked(permissionRepository.findRoleByUserId);
const mockVerifyRefreshToken = jest.mocked(verifyRefreshToken);
const mockCreateRefreshToken = jest.mocked(createRefreshToken);
const mockCreateAccessToken = jest.mocked(createAccessToken);
const mockHashToken = jest.mocked(hashToken);

const userId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const sessionId = "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4";
const claims = { userId, sessionId };
const activeSession = { sessionId, userId, status: "active" as const };

const nextRefresh = {
  token: "new-refresh",
  tokenHash: "new-hash",
  expiresAt: new Date("2026-10-28T10:00:00Z"),
};
const nextAccess = {
  token: "new-access",
  expiresAt: new Date("2026-10-21T10:15:00Z"),
};

beforeEach(() => {
  jest.resetAllMocks();
  // The happy path; each test breaks exactly one step.
  mockVerifyRefreshToken.mockReturnValue(claims);
  mockHashToken.mockReturnValue("old-hash");
  mockFindSession.mockResolvedValue(activeSession);
  mockFindRole.mockResolvedValue("organizer");
  mockCreateRefreshToken.mockReturnValue(nextRefresh);
  mockCreateAccessToken.mockReturnValue(nextAccess);
  mockRotate.mockResolvedValue(true);
});

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
  });

  it("an unknown, revoked, expired or already rotated token (no session for its hash): null", async () => {
    // The repository does return null here, but `const [row] = ...` makes TypeScript infer a
    // non-null type for it, hence the cast.
    mockFindSession.mockResolvedValue(null as never);

    expect(await refreshAuthSession("used-refresh")).toBeNull();
    expect(mockRotate).not.toHaveBeenCalled();
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
  });
});
