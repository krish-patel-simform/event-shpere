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
export const loginResponseSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  role: z.enum(roleNameEnum.enumValues),
});
export type AuthUserDto = z.infer<typeof loginResponseSchema>;

// Set-password form, step 1 of the account-setup email. The same schema validates the
// form in the browser and the request on the server.
export const accountSetupBodySchema = z
  .object({
    token: z.string().min(1, "Missing link token").max(200),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128, "Use at most 128 characters"),
    confirmPassword: z.string(),
  })
  .refine((body) => body.password === body.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type AccountSetupBody = z.infer<typeof accountSetupBodySchema>;
