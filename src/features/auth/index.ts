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
  resendInviteResponseSchema,
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
  type ResendInviteResponseDto,
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
  PermissionProvider,
  type PermissionContextValue,
} from "./components/PermissionProvider";
export { PermissionGate } from "./components/PermissionGate";
export {
  useHasAllPermissions,
  useHasAnyPermission,
  useHasPermission,
  usePermissions,
} from "./hooks/usePermissions";
export {
  ACCOUNT_SETUP_RESEND_COOLDOWN_SECONDS,
  ACCOUNT_SETUP_TOKEN_TTL_HOURS,
  PASSWORD_REGEX,
  PASSWORD_REGEX_MESSAGE,
} from "./constants";
