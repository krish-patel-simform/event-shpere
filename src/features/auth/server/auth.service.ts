import "server-only";
import { env } from "../../../config/env";
import {
  createAuthSession,
  type AuthTokens,
} from "../../../core/auth/server/auth-session";
import {
  hashPassword,
  verifyPassword,
} from "../../../core/auth/server/password";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from "../../../core/http/errors";
import {
  createEmailOtp,
  EMAIL_OTP_TTL_MINUTES,
  emailOtpStore,
  sendVerificationCodeEmail,
  type EmailOtpStore,
} from "../../email/server";
import type {
  AuthUserDto,
  LoginBody,
  OrganizerSignupBody,
  OrganizerSignUpResponseDto,
} from "../schemas/auth.schemas";
import { createEmailVerifyToken } from "./account-activation.service";
import { toAuthUserDto, toOrganizerSignUpDto } from "./auth.dto";
import { authRepository, type AuthRepository } from "./auth.repository";

const INVALID_LOGIN = "Invalid email or password";

const emailTaken = () =>
  new ConflictError("EMAIL_TAKEN", "An account with this email already exists");

export type AuthServiceDeps = {
  authRepository: Pick<
    AuthRepository,
    "findUserForLogin" | "isEmailTaken" | "signUpOrganizer"
  >;
  hashPassword: typeof hashPassword;
  verifyPassword: typeof verifyPassword;
  createAuthSession: typeof createAuthSession;
  createEmailVerifyToken: typeof createEmailVerifyToken;
  createEmailOtp: typeof createEmailOtp;
  emailOtpStore: Pick<EmailOtpStore, "save">;
  sendVerificationCodeEmail: typeof sendVerificationCodeEmail;
  verificationCodeTtlMinutes: number;
  /** Base URL for the verify-email link in the email. */
  appUrl: string;
};

// A factory with injected dependencies, so tests can pass fakes instead of the real DB.
export function createAuthService(deps: AuthServiceDeps) {
  return {
    async login(
      input: LoginBody,
      userAgent: string | null,
    ): Promise<{ user: AuthUserDto; tokens: AuthTokens }> {
      const user = await deps.authRepository.findUserForLogin(input.email);

      // 1. Unknown email: 401.
      if (!user) {
        throw new UnauthorizedError(INVALID_LOGIN);
      }

      // 2. No password yet: an account created by an admin, until its setup link is used.
      if (!user.passwordHash) {
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

      if (user.status === "pending") {
        throw new ForbiddenError(
          "Verify your email with the code we sent you first",
          "EMAIL_NOT_VERIFIED",
        );
      }
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

    /**
     * An organizer registers themselves: pending account (with password) + organizer
     * profile, then a 6-digit code is emailed. No session yet: they log in after verifying.
     */
    async signUpOrganizer(
      input: OrganizerSignupBody,
    ): Promise<OrganizerSignUpResponseDto> {
      // 1. Fast path for a known duplicate: skips the slow argon2 hash below.
      if (await deps.authRepository.isEmailTaken(input.email)) {
        throw emailTaken();
      }
      const passwordHash = await deps.hashPassword(input.password);

      const verifyToken = deps.createEmailVerifyToken();

      // 4. One transaction: user + role + profile + email_verify token, all or nothing.
      const result = await deps.authRepository.signUpOrganizer({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        organizationName: input.organizationName,
        organizationWebsite: input.organizationWebsite ?? null,
        verifyToken: {
          tokenHash: verifyToken.tokenHash,
          expiresAt: verifyToken.expiresAt,
        },
      });
      // A parallel signup with the same email won the race between step 1 and step 4.
      if (!result.ok) throw emailTaken();

      // 5. Only after the commit: the code goes to Redis, then code + link go in the email.
      let emailSent = true;
      try {
        const { otp, otpHash } = deps.createEmailOtp(result.user.email);
        await deps.emailOtpStore.save(result.user.email, otpHash);

        // send the email
        await deps.sendVerificationCodeEmail({
          to: result.user.email,
          firstName: result.user.firstName,
          otp,
          // The raw token exists only here and in the email; the DB has its hash.
          verifyUrl: `${deps.appUrl}/verify-email?token=${encodeURIComponent(verifyToken.token)}`,
          expiresInMinutes: deps.verificationCodeTtlMinutes,
        });
      } catch (error) {
        emailSent = false;
        // Message only: never log the code itself.
        console.error(
          `[auth] verification code not sent for user ${result.user.id}:`,
          error instanceof Error ? error.message : error,
        );
      }

      return toOrganizerSignUpDto(result.user, result.profile, {
        emailSent,
        expiresInMinutes: deps.verificationCodeTtlMinutes,
      });
    },
  };
}

export const authService = createAuthService({
  authRepository,
  hashPassword,
  verifyPassword,
  createAuthSession,
  createEmailVerifyToken,
  createEmailOtp,
  emailOtpStore,
  sendVerificationCodeEmail,
  verificationCodeTtlMinutes: EMAIL_OTP_TTL_MINUTES,
  appUrl: env.APP_URL,
});
