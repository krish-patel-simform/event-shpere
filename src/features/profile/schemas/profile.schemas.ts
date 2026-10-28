import { z } from "zod";
import { passwordSchema } from "@/src/features/auth";

// The forms of "Profile & settings". Matches the limits of users.first_name / last_name
// (varchar 100), so a long name is an inline error here and not a server error later.
const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100, "Use at most 100 characters");

export const profileFormSchema = z.object({
  firstName: nameField("First name"),
  lastName: nameField("Last name"),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const changePasswordFormSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Enter your current password")
      .max(256, "Use at most 256 characters"),
    // The one password policy of the app (also used by signup and reset).
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password that is different from the current one",
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
