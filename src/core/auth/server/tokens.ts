import "server-only";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../../config/env";
import { roleNameEnum, type RoleName } from "../../../db/schemas";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const ALGORITHM = "HS256";
const ISSUER = "event-sphere";
const AUDIENCE = "event-sphere-api";

export type SignedToken = { token: string; expiresAt: Date };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Random, non-JWT token for single-use links (account setup, password reset). */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

// Both token types share one secret, so `typ` keeps them apart: verifyAccessToken rejects a
// refresh token and vice versa.
function signToken(
  payload: Record<string, string>,
  subject: string,
  ttlSeconds: number,
): SignedToken {
  const token = jwt.sign(payload, env.AUTH_JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: ttlSeconds,
    issuer: ISSUER,
    audience: AUDIENCE,
    subject,
  });
  return { token, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
}

function verifyToken<S extends z.ZodType>(
  token: string,
  schema: S,
): z.infer<S> | null {
  try {
    const payload = jwt.verify(token, env.AUTH_JWT_SECRET, {
      algorithms: [ALGORITHM], // never accept another alg (e.g. "none")
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const parsed = schema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    // Expired, bad signature, wrong issuer/audience: all mean "not valid".
    return null;
  }
}

// ---------- Access token: sent on every request, never stored ----------

export type AccessTokenClaims = {
  userId: string;
  /** auth_sessions.id: checked on every request, so logout is immediate. */
  sessionId: string;
  role: RoleName;
};

const accessTokenPayloadSchema = z.object({
  typ: z.literal("access"),
  sub: z.uuid(),
  sid: z.uuid(),
  role: z.enum(roleNameEnum.enumValues),
});

export function createAccessToken(claims: AccessTokenClaims): SignedToken {
  return signToken(
    { typ: "access", sid: claims.sessionId, role: claims.role },
    claims.userId,
    ACCESS_TOKEN_TTL_SECONDS,
  );
}

export function verifyAccessToken(token: string): AccessTokenClaims | null {
  const payload = verifyToken(token, accessTokenPayloadSchema);
  return payload
    ? { userId: payload.sub, sessionId: payload.sid, role: payload.role }
    : null;
}

// ---------- Refresh token: only sent to /api/auth, its hash lives in auth_sessions ----------

export type RefreshTokenClaims = { userId: string; sessionId: string };

const refreshTokenPayloadSchema = z.object({
  typ: z.literal("refresh"),
  sub: z.uuid(),
  sid: z.uuid(),
});

/** `token` goes in the cookie, `tokenHash` in auth_sessions.refresh_token_hash. */
export function createRefreshToken(
  claims: RefreshTokenClaims,
): SignedToken & { tokenHash: string } {
  const signed = signToken(
    { typ: "refresh", sid: claims.sessionId },
    claims.userId,
    REFRESH_TOKEN_TTL_SECONDS,
  );
  return { ...signed, tokenHash: hashToken(signed.token) };
}

export function verifyRefreshToken(token: string): RefreshTokenClaims | null {
  const payload = verifyToken(token, refreshTokenPayloadSchema);
  return payload ? { userId: payload.sub, sessionId: payload.sid } : null;
}
