import "server-only";
import { randomUUID } from "node:crypto";
import type { RoleName } from "../../../db/schemas";
import { authSessionRepository } from "./auth-session.repository";
import { permissionRepository } from "./permission.repository";
import { loadPermissions } from "./permissions.util";
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  verifyAccessToken,
  verifyRefreshToken,
  type SignedToken,
} from "./tokens";

/** The signed-in caller, as every protected route and service sees it. */
export type CurrentUser = {
  id: string;
  sessionId: string;
  role: RoleName;
  permissions: ReadonlySet<string>;
  lastName: string;
  firstName: string;
  email: string;
};

export type AuthTokens = {
  accessToken: SignedToken;
  refreshToken: SignedToken;
};

/**
 * Login: one auth_sessions row (refresh token hash) + an access token pointing at it.
 * Returns null if the user has no role, since such an account cannot do anything.
 */
export async function createAuthSession(
  userId: string,
  userAgent: string | null,
): Promise<{ tokens: AuthTokens; role: RoleName } | null> {
  const role = await permissionRepository.findRoleByUserId(userId);
  if (!role) return null;

  const sessionId = randomUUID();
  const refreshToken = createRefreshToken({ userId, sessionId });
  await authSessionRepository.insert({
    id: sessionId,
    userId,
    refreshTokenHash: refreshToken.tokenHash,
    expiresAt: refreshToken.expiresAt,
    userAgent,
  });

  const accessToken = createAccessToken({ userId, sessionId, role });
  return { tokens: { accessToken, refreshToken }, role };
}

/**
 * A session ends this long after login, however often it is refreshed. Each refresh only
 * extends the sliding 7 days (REFRESH_TOKEN_TTL_SECONDS), never past this.
 */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Trades a refresh token for a new pair (rotation): the old refresh token stops working.
 * The role is re-read here, so a role change reaches the access token on the next refresh.
 * Returns null when the token is invalid, expired, already used, or the user is not active.
 *
 * Reuse: the signature is valid (so the session id inside is real) but no live session holds
 * this token any more. It was already rotated, so someone is replaying it, and the session is
 * revoked: the attacker's access token dies at once and the owner has to log in again.
 * Known trade-off: two tabs refreshing at the same moment look the same, so the loser's
 * request ends the session too. The client already refreshes one request at a time per tab.
 */
export async function refreshAuthSession(
  refreshTokenValue: string,
): Promise<AuthTokens | null> {
  const claims = verifyRefreshToken(refreshTokenValue);
  if (!claims) return null;

  const now = new Date();
  const oldHash = hashToken(refreshTokenValue);
  const session = await authSessionRepository.findValidByRefreshTokenHash(
    oldHash,
    now,
  );
  if (!session) {
    // Also reached after a logout (the row is gone) or when the session expired: revoking
    // is then a no-op.
    await authSessionRepository.revoke(claims.sessionId);
    return null;
  }
  if (
    session.sessionId !== claims.sessionId ||
    session.userId !== claims.userId ||
    session.status !== "active"
  ) {
    return null;
  }

  // The absolute end of the session: refreshing never moves it.
  const sessionEnd = session.createdAt.getTime() + SESSION_MAX_AGE_MS;
  if (now.getTime() >= sessionEnd) return null;

  const role = await permissionRepository.findRoleByUserId(session.userId);
  if (!role) return null;

  const refreshToken = createRefreshToken(claims);
  const rotated = await authSessionRepository.rotateRefreshToken(
    session.sessionId,
    oldHash,
    {
      refreshTokenHash: refreshToken.tokenHash,
      // The sliding 7 days, but never past the absolute end.
      expiresAt: new Date(
        Math.min(refreshToken.expiresAt.getTime(), sessionEnd),
      ),
    },
  );
  // Lost a race inside the database (another request rotated between our read and write):
  // not a replay, so no revoke.
  if (!rotated) return null;

  const accessToken = createAccessToken({ ...claims, role });
  return { accessToken, refreshToken };
}

/** Logout: deleting the row also invalidates every access token carrying its sid. */
export async function revokeAuthSession(
  refreshTokenValue: string,
): Promise<void> {
  await authSessionRepository.deleteByRefreshTokenHash(
    hashToken(refreshTokenValue),
  );
}

/** The user behind an access token, or null if the token or its session is no longer valid. */
export async function resolveCurrentUser(
  accessTokenValue: string,
): Promise<CurrentUser | null> {
  const claims = verifyAccessToken(accessTokenValue);
  if (!claims) return null;

  const session = await authSessionRepository.findValidById(
    claims.sessionId,
    new Date(),
  );
  // Logged out, expired, or suspended: rejected now, not when the access token expires.
  if (
    !session ||
    session.userId !== claims.userId ||
    session.status !== "active"
  ) {
    return null;
  }

  return {
    id: session.userId,
    sessionId: claims.sessionId,
    role: claims.role,
    permissions: await loadPermissions(claims.role),
    firstName: session.firstName,
    lastName: session.lastName,
    email: session.email,
  };
}
