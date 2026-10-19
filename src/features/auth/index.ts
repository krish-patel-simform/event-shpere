// Client-safe public API of the auth feature: shared schemas/types and, later, the
// frontend (api service, React Query hooks, components). Never export anything from ./server here.
export {
  accountSetupBodySchema,
  loginResponseSchema,
  loginBodySchema,
  type AccountSetupBody,
  type AuthUserDto,
  type LoginBody,
} from "./schemas/auth.schemas";
export { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "./constants";
