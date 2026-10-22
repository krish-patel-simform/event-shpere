// Calls to the auth API, built on the shared axios instance. React Query hooks
// (../hooks) wrap these; components use the hooks.
import { apiRequest } from "../../../core/api-client/base-api.service";
import {
  loginResponseSchema,
  meResponseSchema,
  organizerSignUpResponseSchema,
  userSignupResponseSchema,
  type AccountSetupBody,
  type AuthUserDto,
  type ForgotPasswordBody,
  type LoginBody,
  type MeDto,
  type OrganizerSignUpResponseDto,
  type OrganizerSignupBody,
  type ResendOtpBody,
  type ResetPasswordBody,
  type UserSignUpResponseDto,
  type UserSignupBody,
  type VerifyEmailBody,
} from "../schemas/auth.schemas";

export const authApiService = {
  /** Step 2 of the setup email. The server sets the token cookies. */
  login(body: LoginBody): Promise<AuthUserDto> {
    return apiRequest(
      { method: "POST", url: "/auth/login", data: body },
      loginResponseSchema,
    );
  },

  /** Ends the session and clears the token cookies (204; also fine when already logged out). */
  logout(): Promise<void> {
    return apiRequest({ method: "POST", url: "/auth/logout" });
  },

  /** Who is signed in and what they may do. 401 when there is no valid session. */
  getMe(): Promise<MeDto> {
    return apiRequest({ method: "GET", url: "/auth/me" }, meResponseSchema);
  },

  /** Creates a pending attendee account and emails the verification code (201). No session yet. */
  signUpUser(body: UserSignupBody): Promise<UserSignUpResponseDto> {
    return apiRequest(
      { method: "POST", url: "/auth/signup/user", data: body },
      userSignupResponseSchema,
    );
  },

  /** Creates a pending organizer account (awaiting admin review) and emails the code (201). */
  signUpOrganizer(
    body: OrganizerSignupBody,
  ): Promise<OrganizerSignUpResponseDto> {
    return apiRequest(
      { method: "POST", url: "/auth/signup/organizer", data: body },
      organizerSignUpResponseSchema,
    );
  },

  /** Confirms the signup email with the link's token + the 6-digit code (204). No session yet. */
  verifyEmail(body: VerifyEmailBody): Promise<void> {
    return apiRequest({
      method: "POST",
      url: "/auth/verify-email",
      data: body,
    });
  },

  /** Emails a new verification code and link (204; same answer whether or not the account exists). */
  resendOtp(body: ResendOtpBody): Promise<void> {
    return apiRequest({
      method: "POST",
      url: "/auth/resend-otp",
      data: body,
    });
  },

  /** Step 1 of the setup email: set the first password (204, no body). */
  completeAccountSetup(body: AccountSetupBody): Promise<void> {
    return apiRequest({
      method: "POST",
      url: "/auth/account-setup",
      data: body,
    });
  },

  /** Asks for a password reset link (204, no body; same answer whether or not the email exists). */
  forgotPassword(body: ForgotPasswordBody): Promise<void> {
    return apiRequest({
      method: "POST",
      url: "/auth/forgot-password",
      data: body,
    });
  },

  /** Sets a new password with the emailed link's token (204, no body; revokes every session). */
  resetPassword(body: ResetPasswordBody): Promise<void> {
    return apiRequest({
      method: "POST",
      url: "/auth/reset-password",
      data: body,
    });
  },
};
