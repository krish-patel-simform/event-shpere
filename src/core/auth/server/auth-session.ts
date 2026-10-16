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
 * Trades a refresh token for a new pair (rotation): the old refresh token stops working.
 * The role is re-read here, so a role change reaches the access token on the next refresh.
 * Returns null when the token is invalid, expired, already used, or the user is not active.
 */
export async function refreshAuthSession(
  refreshTokenValue: string,
): Promise<AuthTokens | null> {
  const claims = verifyRefreshToken(refreshTokenValue);
  if (!claims) return null;

  const oldHash = hashToken(refreshTokenValue);
  const session = await authSessionRepository.findValidByRefreshTokenHash(
    oldHash,
    new Date(),
  );
  if (
    !session ||
    session.sessionId !== claims.sessionId ||
    session.userId !== claims.userId ||
    session.status !== "active"
  ) {
    return null;
  }

  const role = await permissionRepository.findRoleByUserId(session.userId);
  if (!role) return null;

  const refreshToken = createRefreshToken(claims);
  const rotated = await authSessionRepository.rotateRefreshToken(
    session.sessionId,
    oldHash,
    {
      refreshTokenHash: refreshToken.tokenHash,
      expiresAt: refreshToken.expiresAt,
    },
  );
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
    id: claims.userId,
    sessionId: claims.sessionId,
    role: claims.role,
    permissions: await loadPermissions(claims.role),
  };
}
