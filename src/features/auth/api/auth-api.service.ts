// Calls to the auth API, built on the shared axios instance. React Query hooks
// (../hooks) wrap these; components use the hooks.
import { apiRequest } from "../../../core/api-client/base-api.service";
import {
  loginResponseSchema,
  type AccountSetupBody,
  type AuthUserDto,
  type ForgotPasswordBody,
  type LoginBody,
} from "../schemas/auth.schemas";

export const authApiService = {
  /** Step 2 of the setup email. The server sets the token cookies. */
  login(body: LoginBody): Promise<AuthUserDto> {
    return apiRequest(
      { method: "POST", url: "/auth/login", data: body },
      loginResponseSchema,
    );
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
};
