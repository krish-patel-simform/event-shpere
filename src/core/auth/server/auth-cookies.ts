import "server-only";
import { cookies } from "next/headers";
import type { AuthTokens } from "./auth-session";

const ACCESS_TOKEN_COOKIE = "es_access_token";
const REFRESH_TOKEN_COOKIE = "es_refresh_token";
// The refresh token is only ever sent to /api/auth/* (refresh, logout), never to other routes.
const REFRESH_TOKEN_PATH = "/api/auth";

const baseOptions = {
  httpOnly: true, // JavaScript in the page can never read it
  secure: process.env.NODE_ENV === "production", // HTTPS only in prod; plain http on localhost
  sameSite: "lax", // not sent on cross-site POSTs
} as const;

export async function readAccessTokenCookie(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function readRefreshTokenCookie(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value;
}

/** Only callable from a Route Handler or Server Function (Next.js rule for setting cookies). */
export async function writeAuthCookies(tokens: AuthTokens): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, tokens.accessToken.token, {
    ...baseOptions,
    path: "/",
    expires: tokens.accessToken.expiresAt,
  });
  store.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken.token, {
    ...baseOptions,
    path: REFRESH_TOKEN_PATH,
    expires: tokens.refreshToken.expiresAt,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  // A cookie is only removed when the path matches the one it was set with.
  store.set(ACCESS_TOKEN_COOKIE, "", { ...baseOptions, path: "/", maxAge: 0 });
  store.set(REFRESH_TOKEN_COOKIE, "", {
    ...baseOptions,
    path: REFRESH_TOKEN_PATH,
    maxAge: 0,
  });
  // Browsers that logged in before the refresh cookie moved to REFRESH_TOKEN_PATH still hold one
  // on "/". Remove it too, or it would keep being sent to every route.
  store.set(REFRESH_TOKEN_COOKIE, "", { ...baseOptions, path: "/", maxAge: 0 });
}
