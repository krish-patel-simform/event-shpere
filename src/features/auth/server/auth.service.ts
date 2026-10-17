import "server-only";
import {
  createAuthSession,
  type AuthTokens,
} from "../../../core/auth/server/auth-session";
import {
  hashPassword,
  verifyPassword,
} from "../../../core/auth/server/password";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import { ForbiddenError, UnauthorizedError } from "../../../core/http/errors";
import type { AuthUserDto, LoginBody } from "../schemas/auth.schemas";
import { toAuthUserDto } from "./auth.dto";
import { authRepository, type AuthRepository } from "./auth.repository";

const INVALID_LOGIN = "Invalid email or password";

export type AuthServiceDeps = {
  authRepository: Pick<AuthRepository, "findUserForLogin">;
  hashPassword: typeof hashPassword;
  verifyPassword: typeof verifyPassword;
  createAuthSession: typeof createAuthSession;
};

// A factory with injected dependencies, so tests can pass fakes instead of the real DB.
export function createAuthService(deps: AuthServiceDeps) {
  // For an unknown email, argon2 still runs against this dummy hash, so the failure takes
  // as long as a wrong password and timing does not reveal which emails exist.

  return {
    async login(
      input: LoginBody,
      userAgent: string | null,
    ): Promise<{ user: AuthUserDto; tokens: AuthTokens }> {
      const user = await deps.authRepository.findUserForLogin(input.email);

      // 1. Unknown email: 401, after a dummy hash check (same timing as a wrong password).
      if (!user) {
        throw new UnauthorizedError(INVALID_LOGIN);
      }

      // 2. No password yet: the account is pending until the setup link is used.
      if (!user.passwordHash || user.status === "pending") {
        throw new ForbiddenError(
          "Set your password using the link sent to your email first",
          "PASSWORD_NOT_SET",
        );
      }

      // 3. Wrong password: 401.
      const passwordOk = await deps.verifyPassword(
        user.passwordHash,
        input.password,
      );
      if (!passwordOk) throw new UnauthorizedError(INVALID_LOGIN);

      // 4. Suspended: only revealed to someone who knows the correct password.
      if (user.status === "suspended") {
        throw new ForbiddenError(
          "Your account is suspended",
          "ACCOUNT_SUSPENDED",
        );
      }

      const userSession = await deps.createAuthSession(user.id, userAgent);
      if (!userSession) throw new UnauthorizedError(INVALID_LOGIN); // account has no role

      return {
        user: toAuthUserDto(user, userSession.role),
        tokens: userSession.tokens,
      };
    },
  };
}

export const authService = createAuthService({
  authRepository,
  hashPassword,
  verifyPassword,
  createAuthSession,
});
