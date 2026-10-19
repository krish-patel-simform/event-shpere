// Server-only entry of the auth feature: what route handlers and server components import.
import "server-only";

export { authService } from "./auth.service";
export {
  accountSetupService,
  createAccountSetupToken,
  type AccountSetupToken,
} from "./account-setup.service";
