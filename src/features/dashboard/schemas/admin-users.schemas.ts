import { z } from "zod";
import { roleNameEnum } from "../../../db/schemas";

// Forms of the admin "Users" page. The same schemas will validate the request bodies on the server
// once the endpoints exist (then they move next to them).

export const SUSPEND_REASON_MAX = 500;

//* Suspend a user
export const suspendUserBodySchema = z.object({
  /** Kept in the audit log. */
  reason: z
    .string()
    .trim()
    .min(1, "Enter a reason: it is kept in the audit log.")
    .max(
      SUSPEND_REASON_MAX,
      `Keep the reason under ${SUSPEND_REASON_MAX} characters`,
    ),
  /** Email the person to say the account was suspended. */
  notifyUser: z.boolean(),
});
export type SuspendUserBody = z.infer<typeof suspendUserBodySchema>;

//* Change a user's role (one role per user)
export const changeUserRoleBodySchema = z.object({
  role: z.enum(roleNameEnum.enumValues),
});
export type ChangeUserRoleBody = z.infer<typeof changeUserRoleBodySchema>;

//* Invite someone: they get a password-setup link and choose their own password
export const INVITE_ROLES = ["speaker", "organizer", "admin"] as const;

export const inviteUserBodySchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  // users.email is stored lowercase (check constraint).
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address"))
    .pipe(z.string().max(255)),
  role: z.enum(INVITE_ROLES),
});
export type InviteUserBody = z.infer<typeof inviteUserBodySchema>;
