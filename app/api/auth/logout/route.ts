import {
  clearAuthCookies,
  readRefreshTokenCookie,
} from "@/src/core/auth/server/auth-cookies";
import { revokeAuthSession } from "@/src/core/auth/server/auth-session";
import { noContent, route } from "@/src/core/http";

// AUTH-9: ends the session. Deleting the auth_sessions row makes every access token of that
// session invalid at once (each request checks the row), then the cookies are removed.
// Public on purpose: a person whose access token has expired must still be able to log out, and
// the refresh cookie is the credential. Always 204, even with no cookie (already logged out).
// If revoking fails (database down) the error is returned and the cookies are kept: telling the
// user they are logged out while the session still works would be worse than showing an error.
export const POST = route({ auth: "public" }, async () => {
  const refreshToken = await readRefreshTokenCookie();
  if (refreshToken) await revokeAuthSession(refreshToken);

  await clearAuthCookies();
  return noContent();
});
