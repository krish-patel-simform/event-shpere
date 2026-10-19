import { z } from "zod";
import { roleNameEnum, userStatusEnum } from "../../../db/schemas";
import { PASSWORD_REGEX, PASSWORD_REGEX_MESSAGE } from "../constants";

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

// One password policy for every place a password is SET (account setup, signup, later
// reset/change), so the rules can never drift apart. The regex also enforces the 8-char minimum.
export const passwordSchema = z
  .string()
  .max(128, "Use at most 128 characters")
  .regex(PASSWORD_REGEX, PASSWORD_REGEX_MESSAGE);

// Set-password form, step 1 of the account-setup email. The same schema validates the
// form in the browser and the request on the server.
export const accountSetupBodySchema = z
  .object({
    token: z.string().min(1, "Missing link token").max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((body) => body.password === body.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type AccountSetupBody = z.infer<typeof accountSetupBodySchema>;

// Verify-email page (opened from the signup email): `token` comes from the link's
// ?token=…, `otp` is the 6-digit code the user types. The email is not sent: the server
// takes it from the token's user, so a code can only be tried against its own account.
export const verifyEmailBodySchema = z.object({
  token: z.string().min(1, "Missing link token").max(200),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;

//* Register Organizer by self
export const organizerSignupBodySchema = z
  .object({
    // trim first, so "   " fails min(1); max matches varchar(100), so a long name is a 400 not a 500.
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email())
      .pipe(z.string().max(255)),
    password: passwordSchema,
    // Only has to match: the refine below checks it, the strength rules are on `password`.
    confirmPassword: z.string(),
    organizationName: z
      .string()
      .trim()
      .min(1, "Organization name is required")
      .max(255),
    organizationWebsite: z
      .url({ protocol: /^https?$/, message: "Use a full http(s) URL" })
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type OrganizerSignupBody = z.infer<typeof organizerSignupBodySchema>;

export const organizerSignUpResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  status: z.enum(userStatusEnum.enumValues),
  organizationName: z.string(),
  organizationWebsite: z.string().nullable(),

  isVerified: z.boolean(),
  createdAt: z.iso.datetime(),

  verificationEmailSent: z.boolean(),

  verificationCodeExpiresInMinutes: z.number().int().positive(),
});
export type OrganizerSignUpResponseDto = z.infer<
  typeof organizerSignUpResponseSchema
>;

// Post Verify the OPT
export const verifyOtpBodySchema = z.object({
  otp: z.coerce.number().min(6).max(6),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .pipe(z.string().max(255)),
  token: z.string().min(1, "Missing link token").max(200),
});

export type VerifyOtpBody = z.infer<typeof verifyOtpBodySchema>;

export const verifyOtpResponseSchema = z.object({
  firstName: z.string().trim().min(1).max(255),
  lastName: z.string().trim().min(1).max(255),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .pipe(z.string().max(255)),
  verifiedAt: z.iso.datetime(),
});
