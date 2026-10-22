import {
  readRefreshTokenCookie,
  writeAuthCookies,
} from "@/src/core/auth/server/auth-cookies";
import { refreshAuthSession } from "@/src/core/auth/server/auth-session";
import { noContent, route, UnauthorizedError } from "@/src/core/http";

// Trades the refresh-token cookie for a new access + refresh pair (rotation: the old refresh
// token stops working). Public on purpose: it is called when the access token has expired, so
// the only credential is the refresh cookie. The browser client calls it when a request gets 401.
// On failure it does NOT clear the cookies: if two tabs refresh at once, the loser would
// otherwise wipe the new cookies the winner just set and log both tabs out.
export const POST = route({ auth: "public" }, async () => {
  const refreshToken = await readRefreshTokenCookie();
  const tokens = refreshToken ? await refreshAuthSession(refreshToken) : null;
  if (!tokens) throw new UnauthorizedError("Session expired");

  await writeAuthCookies(tokens);
  return noContent();
});
