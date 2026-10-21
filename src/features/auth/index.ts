// Client-safe public API of the auth feature: shared schemas/types and, later, the
// frontend (api service, React Query hooks, components). Never export anything from ./server here.
export {
  accountSetupBodySchema,
  forgotPasswordBodySchema,
  loginResponseSchema,
  loginBodySchema,
  organizerSignupBodySchema,
  organizerSignUpResponseSchema,
  passwordSchema,
  resendOtpBodySchema,
  resetPasswordBodySchema,
  userSignupBodySchema,
  userSignupResponseSchema,
  verifyEmailBodySchema,
  type AccountSetupBody,
  type AuthUserDto,
  type ForgotPasswordBody,
  type LoginBody,
  type OrganizerSignupBody,
  type OrganizerSignUpResponseDto,
  type ResendOtpBody,
  type ResetPasswordBody,
  type UserSignupBody,
  type UserSignUpResponseDto,
  type VerifyEmailBody,
} from "./schemas/auth.schemas";
export {
  ACCOUNT_SETUP_TOKEN_TTL_HOURS,
  PASSWORD_REGEX,
  PASSWORD_REGEX_MESSAGE,
} from "./constants";
