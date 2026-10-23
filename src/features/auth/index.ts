// Client-safe public API of the auth feature: shared schemas/types and the hooks other features
// need (useMe). Never export anything from ./server here.
export {
  accountSetupBodySchema,
  emailSchema,
  forgotPasswordBodySchema,
  loginResponseSchema,
  loginBodySchema,
  meResponseSchema,
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
  type MeDto,
  type OrganizerSignupBody,
  type OrganizerSignUpResponseDto,
  type ResendOtpBody,
  type ResetPasswordBody,
  type UserSignupBody,
  type UserSignUpResponseDto,
  type VerifyEmailBody,
} from "./schemas/auth.schemas";
export { AUTH_ROUTES } from "./routes";
// A "use client" module, so importing this barrel from a route handler never evaluates it.
export { authQueryKeys, useMe } from "./hooks/useMe";
export { useLogout } from "./hooks/useLogout";
export {
  ACCOUNT_SETUP_TOKEN_TTL_HOURS,
  PASSWORD_REGEX,
  PASSWORD_REGEX_MESSAGE,
} from "./constants";
