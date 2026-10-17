// Client-safe public API of the auth feature: shared schemas/types and, later, the
// frontend (RTK Query api, components, hooks). Never export anything from ./server here.
export {
  authUserResponseSchema,
  loginBodySchema,
  type AuthUserDto,
  type LoginBody,
} from "./schemas/auth.schemas";
