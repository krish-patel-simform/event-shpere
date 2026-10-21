import { z } from "zod";
import { roleNameEnum, userStatusEnum } from "../../../db/schemas";
import {
  PASSWORD_REGEX,
  PASSWORD_REGEX_MESSAGE,
  PHONE_REGEX,
  PHONE_REGEX_MESSAGE,
} from "../constants";

// One password policy for every place a password is SET (account setup, signup, later
// reset/change), so the rules can never drift apart. The regex also enforces the 8-char minimum.
export const passwordSchema = z
  .string()
  .max(128, "Use at most 128 characters")
  .regex(PASSWORD_REGEX, PASSWORD_REGEX_MESSAGE);

export const phoneSchema = z.string().regex(PHONE_REGEX, PHONE_REGEX_MESSAGE);

// ---------- shared field rules: one definition, used by every form that has the field ----------

// users.email is stored lowercase (check constraint) and is varchar(255).
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .pipe(z.string().max(255));

// trim first, so "   " fails min(1); max matches varchar(100), so a long name is a 400 not a 500.
const nameSchema = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(100);

// Every form that sets a password asks for it twice. The strength rules live on
// passwordSchema; confirmPassword only has to match.
const passwordsMatch = (body: { password: string; confirmPassword: string }) =>
  body.password === body.confirmPassword;
const PASSWORDS_MATCH_ERROR = {
  path: ["confirmPassword"],
  message: "Passwords do not match",
};

// Fields every self-signup has (organizer, user). A PLAIN object on purpose: Zod throws on
// .pick()/.omit() of a refined object, so each signup extends this and adds the refine LAST.
const signupBaseSchema = z.object({
  firstName: nameSchema("First name"),
  lastName: nameSchema("Last name"),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
});

// Request: what the client must send.
export const loginBodySchema = z.object({
  email: emailSchema,
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
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, PASSWORDS_MATCH_ERROR);
export type AccountSetupBody = z.infer<typeof accountSetupBodySchema>;

// Verify-email page (opened from the signup email): `token` comes from the link's
// ?token=…, `otp` is the 6-digit code the user types. The email is not sent: the server
// takes it from the token's user, so a code can only be tried against its own account.
export const verifyEmailBodySchema = z.object({
  token: z.string().min(1, "Missing link token").max(200),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;

//* Register Organizer by self: the shared signup fields + the organization.
export const organizerSignupBodySchema = signupBaseSchema
  .extend({
    organizationName: z
      .string()
      .trim()
      .min(1, "Organization name is required")
      .max(255),
    // http(s) only: a "javascript:" URL here would later end up in a link on the site.
    organizationWebsite: z
      .url({ protocol: /^https?$/, message: "Use a full http(s) URL" })
      .optional(),
  })
  .refine(passwordsMatch, PASSWORDS_MATCH_ERROR);

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

//* Post Verify the OPT
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

//* Sign up for the user (AUTH-1): the shared signup fields + optional profile details.
export const userSignupBodySchema = signupBaseSchema
  .extend({
    // Optional: user_profiles.phone is nullable. When given, it must be a valid number.
    phone: z.string().trim().regex(PHONE_REGEX, PHONE_REGEX_MESSAGE).optional(),
    city: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
    avatarUrl: z
      .url({ protocol: /^https?$/, message: "Use a full http(s) URL" })
      .optional(),
  })
  .refine(passwordsMatch, PASSWORDS_MATCH_ERROR);
export type UserSignupBody = z.infer<typeof userSignupBodySchema>;

// The profile fields are nullable because the DB stores a skipped field as null.
export const userSignupResponseSchema = z.object({
  userId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  /** `pending` until the email is verified with the emailed code. */
  status: z.enum(userStatusEnum.enumValues),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  /** Email verified (users.email_verified_at set): false right after signup. */
  isVerified: z.boolean(),
  /** False if the account was created but the code could not be sent: offer "resend". */
  verificationEmailSent: z.boolean(),
  verificationCodeExpiresInMinutes: z.number().int().positive(),
});
export type UserSignUpResponseDto = z.infer<typeof userSignupResponseSchema>;

//* POST Forgot Password

export const forgotPasswordBodySchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;

//* Post reset teh password
export const resetPasswordBodySchema = z
  .object({
    token: z.string().min(1, "Missing link token").max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, PASSWORDS_MATCH_ERROR);

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

//* Post the resend OTP

export const resendOtpBodySchema = z.object({
  email: emailSchema,
});

export type ResendOtpBody = z.infer<typeof resendOtpBodySchema>;
