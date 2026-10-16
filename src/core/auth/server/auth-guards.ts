import "server-only";
// Direct file import (not the core/http barrel): the barrel imports this file.
import { ForbiddenError, UnauthorizedError } from "../../http/errors";
import { readAccessTokenCookie } from "./auth-cookies";
import { resolveCurrentUser, type CurrentUser } from "./auth-session";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const accessToken = await readAccessTokenCookie();
  return accessToken ? resolveCurrentUser(accessToken) : null;
}

/** 401 unless signed in with a valid access token. */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** 403 unless the user's role grants every one of the listed permissions. */
export function assertPermission(
  user: CurrentUser,
  permissions: string[],
): void {
  if (!permissions.every((permission) => user.permissions.has(permission))) {
    throw new ForbiddenError();
  }
}
