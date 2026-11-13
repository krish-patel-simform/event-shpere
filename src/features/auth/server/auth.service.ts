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
import { ForbiddenError, UnauthorizedError } from "../../../core/http/errors";
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
  ResendOtpBody,
  SignUpResponseDto,
  UserSignupBody,
} from "../schemas/auth.schemas";
import { createEmailVerifyToken } from "./account-activation.service";
import { toAuthUserDto, toSignUpDto } from "./auth.dto";
import { authRepository, type AuthRepository } from "./auth.repository";

const INVALID_LOGIN = "Invalid email or password";

export type AuthServiceDeps = {
  authRepository: Pick<
    AuthRepository,
    | "findUserForLogin"
    | "isEmailTaken"
    | "signUpOrganizer"
    | "signUpUser"
    | "resendOtpEmail"
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
  /**
   * A real hash of a throwaway password, made once (on the first failed lookup) with the same
   * hashPassword as real accounts so its argon2 settings match. login verifies against it when
   * there is no real hash, to keep the response time the same.
   */
  let dummyPasswordHash: Promise<string> | undefined;
  const getDummyPasswordHash = () =>
    (dummyPasswordHash ??= deps.hashPassword(
      "timing-equalizer-not-a-password",
    ));

  /**
   * What a signup answers when the email already has an account (or a parallel signup took it):
   * the same shape and values as a new signup, so the response never reveals which emails are
   * registered. Nothing is created and nothing is sent.
   */
  const duplicateSignUpAnswer = (email: string): SignUpResponseDto =>
    toSignUpDto(email, {
      emailSent: true,
      expiresInMinutes: deps.verificationCodeTtlMinutes,
    });

  /**
   * Shared by every self-signup, called only AFTER the account is committed (a rolled-back
   * account must never get a code): new 6-digit code → its hash in Redis → code + verify
   * link emailed. Never throws: false = the account exists but the code was not sent, so
   * the client offers "resend".
   */
  async function sendSignupVerification(
    user: { id: string; email: string; firstName: string },
    rawVerifyToken: string,
  ): Promise<boolean> {
    try {
      const { otp, otpHash } = deps.createEmailOtp(user.email);
      await deps.emailOtpStore.save(user.email, otpHash);
      await deps.sendVerificationCodeEmail({
        to: user.email,
        firstName: user.firstName,
        otp,
        // The raw token exists only here and in the email; the DB has its hash.
        verifyUrl: `${deps.appUrl}/verify-email?token=${encodeURIComponent(rawVerifyToken)}`,
        expiresInMinutes: deps.verificationCodeTtlMinutes,
      });
      return true;
    } catch (error) {
      // Message only: never log the code itself.
      console.error(
        `[auth] verification code not sent for user ${user.id}:`,
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  }

  return {
    //* Login
    async login(
      input: LoginBody,
      userAgent: string | null,
    ): Promise<{ user: AuthUserDto; tokens: AuthTokens }> {
      const user = await deps.authRepository.findUserForLogin(input.email);

      // Always run one argon2 verify, even for an unknown email or an account without a password
      // yet (created by an admin, setup link not used): against a dummy hash, so every failed
      // login takes the same time and the response time cannot tell whether the account exists.
      const passwordOk = await deps.verifyPassword(
        user?.passwordHash ?? (await getDummyPasswordHash()),
        input.password,
      );

      // Unknown email, no password yet and wrong password: the same 401, never a hint which.
      if (!user || !user.passwordHash || !passwordOk) {
        throw new UnauthorizedError(INVALID_LOGIN);
      }

      // Only a correct password gets to hear the account state.
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

    /** //* An organizer registers themselves: pending account (with password) + organizer
     * profile, then a 6-digit code is emailed. No session yet: they log in after verifying.
     */
    async signUpOrganizer(
      input: OrganizerSignupBody,
    ): Promise<SignUpResponseDto> {
      // Hashed before the duplicate check, so a known email costs the same slow hash as a new one.
      const passwordHash = await deps.hashPassword(input.password);

      // 1. A known email gets the same answer as a new one, and nothing is created or sent.
      if (await deps.authRepository.isEmailTaken(input.email)) {
        return duplicateSignUpAnswer(input.email);
      }

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
      if (!result.ok) return duplicateSignUpAnswer(input.email);

      // 5. Only after the commit: code → Redis, code + link → email.
      const emailSent = await sendSignupVerification(
        result.user,
        verifyToken.token,
      );

      return toSignUpDto(result.user.email, {
        emailSent,
        expiresInMinutes: deps.verificationCodeTtlMinutes,
      });
    },

    /** //* AUTH-1: a user (attendee) registers: pending account + profile, then a code is emailed. */
    async signUpUser(input: UserSignupBody): Promise<SignUpResponseDto> {
      // Hashed before the duplicate check, so a known email costs the same slow hash as a new one.
      const passwordHash = await deps.hashPassword(input.password);

      // A known email gets the same answer as a new one, and nothing is created or sent.
      if (await deps.authRepository.isEmailTaken(input.email)) {
        return duplicateSignUpAnswer(input.email);
      }

      const verifyToken = deps.createEmailVerifyToken();

      // One transaction: user + role + profile + email_verify token, all or nothing.
      const result = await deps.authRepository.signUpUser({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        city: input.city ?? null,
        phone: input.phone ?? null,
        postalCode: input.postalCode ?? null,
        // Only the hash goes to the repository; the raw token stays here for the email.
        verifyToken: {
          tokenHash: verifyToken.tokenHash,
          expiresAt: verifyToken.expiresAt,
        },
      });
      // A parallel signup with the same email won the race.
      if (!result.ok) return duplicateSignUpAnswer(input.email);

      // Only after the commit: code → Redis, code + link → email.
      const emailSent = await sendSignupVerification(
        result.user,
        verifyToken.token,
      );

      return toSignUpDto(result.user.email, {
        emailSent,
        expiresInMinutes: deps.verificationCodeTtlMinutes,
      });
    },

    /**
     * Resends the verification code and link to a PENDING account. Always resolves the same way,
     * found or not: the caller must never be able to tell whether an account exists. Every
     * resend replaces the code (emailOtpStore.save overwrites it) and the link (the repository
     * invalidates the old ones), so only the newest email works, however many are requested.
     */
    async resendOtp(input: ResendOtpBody, now = new Date()): Promise<void> {
      const verifyToken = deps.createEmailVerifyToken(now);

      const result = await deps.authRepository.resendOtpEmail({
        email: input.email,
        verifyToken: {
          tokenHash: verifyToken.tokenHash,
          expiresAt: verifyToken.expiresAt,
        },
        now,
      });

      // No pending account (unknown, already verified, suspended): the same quiet answer.
      if (!result.ok) return;

      // Only after the new link is saved. Never throws: a failed send is logged inside.
      await sendSignupVerification(result.user, verifyToken.token);
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
