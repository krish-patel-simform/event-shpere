import { z } from "zod";
import { roleNameEnum } from "../../../db/schemas";

// Request: what the client must send.
export const loginBodySchema = z.object({
  // users.email is stored lowercase (check constraint), so compare lowercase.
  email: z.string().trim().toLowerCase().pipe(z.email()),
  // No strength rules on login: the policy applies when a password is set.
  password: z.string().min(1, "Password is required").max(256),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

// Login response: who signed in. Permissions are not here; GET /api/auth/me returns them.
// Parsing with this schema guarantees no extra field (e.g. passwordHash) leaks.
export const authUserResponseSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  role: z.enum(roleNameEnum.enumValues),
});
export type AuthUserDto = z.infer<typeof authUserResponseSchema>;
