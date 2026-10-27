import { z } from "zod";
import { userStatusEnum } from "../../../db/schemas";

//* POST /api/admin/organizers: what the admin fills in.
export const createOrganizerBodySchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  // users.email is stored lowercase (check constraint).
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .pipe(z.string().max(255)),
  organizationName: z
    .string()
    .trim()
    .min(1, "Organization name is required")
    .max(255),
  // http(s) only: a "javascript:" URL here would later end up in a link on the site.
  organizationWebsite: z
    .url({ protocol: /^https?$/, message: "Use a full http(s) URL" })
    .optional(),
});
export type CreateOrganizerBody = z.infer<typeof createOrganizerBodySchema>;

export const createOrganizerResponseSchema = z.object({
  /** organizer_profiles.id */
  id: z.uuid(),
  userId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  /** `pending` until the organizer sets a password from the email. */
  status: z.enum(userStatusEnum.enumValues),
  organizationName: z.string(),
  organizationWebsite: z.string().nullable(),
  /** Admin verification of the organization (separate from the email being verified). */
  isVerified: z.boolean(),
  createdAt: z.iso.datetime(),
  /** False if the account was created but the setup email could not be queued. */
  setupEmailQueued: z.boolean(),
});
export type CreateOrganizerResponseDto = z.infer<
  typeof createOrganizerResponseSchema
>;

//* GET /api/admin/organizers: list of organizers

// The ONLY columns the list can be searched by (DB column names). Never pass a column
// name from the URL straight into SQL: this whitelist stops e.g. searchField=password_hash.
// To add one: add it here AND to `searchConditions` in organizer.repository.ts.
export const organizerSearchFields = ["organization_name"] as const;
export type OrganizerSearchField = (typeof organizerSearchFields)[number];

/**
 * Where an organizer application stands. Not a column: derived from the timestamps
 * (verified_at set = verified, rejected_at set = rejected, neither = pending).
 */
export const organizerReviewStatuses = [
  "pending",
  "verified",
  "rejected",
] as const;
export type OrganizerReviewStatus = (typeof organizerReviewStatuses)[number];

/** `pending` = waiting for the admin (the approval queue), `verified` = approved, `rejected`. */
export const organizerVerificationFilters = organizerReviewStatuses;
export type OrganizerVerificationFilter =
  (typeof organizerVerificationFilters)[number];

// Search and the verification filter are optional: without them the list is not filtered.
export const organizerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50),
  searchField: z.enum(organizerSearchFields).nullish(),
  searchValue: z.string().trim().max(100).nullish(),
  verification: z.enum(organizerVerificationFilters).nullish(),
});

export type ListOrganizersQuery = z.infer<typeof organizerQuerySchema>;
// One row of the list.
const organizerListItemSchema = z.object({
  /** organizer_profiles.id: what the admin sends to verify this organizer. */
  id: z.uuid(),
  /** The organizer (the person), from users. */
  organizerFirstName: z.string(),
  organizerLastName: z.string(),
  /** Admin-only route: the admin needs it to contact the applicant. */
  email: z.email(),
  /** The applicant confirmed their email. Verifying the organizer needs this first. */
  emailVerified: z.boolean(),
  /** `pending` = has not set a password yet (invited, ADM-6 can resend the invite). */
  accountStatus: z.enum(userStatusEnum.enumValues),
  organizationName: z.string(),
  organizationWebsite: z.string().nullable(),
  /** When the organizer profile was created (applied or was invited). */
  appliedAt: z.iso.datetime(),
  /** null = not verified yet. */
  verifiedAt: z.iso.datetime().nullable(),
  /** Full name of the admin who verified; null = not verified yet. */
  verifiedBy: z.string().nullable(),
  /** null = not rejected. */
  rejectedAt: z.iso.datetime().nullable(),
  /** The admin's reason; null = not rejected. */
  rejectionReason: z.string().nullable(),
});
export type OrganizerListItemDto = z.infer<typeof organizerListItemSchema>;

// `data` of the list response (pagination `meta` is sent next to it).
export const getOrganizersResponseSchema = z.array(organizerListItemSchema);

//* POST /api/admin/organizers/[organizerId]: verify the organizer
export const verifyOrganizerParamsSchema = z.object({
  /** organizer_profiles.id of the organizer to verify. */
  organizerId: z.uuid(),
});
export type VerifyOrganizerParams = z.infer<typeof verifyOrganizerParamsSchema>;

//* POST /api/admin/organizers/[organizerId]/resend-invite (ADM-6)
export const resendOrganizerInviteParamsSchema = z.object({
  /** organizer_profiles.id of the organizer to re-invite. */
  organizerId: z.uuid(),
});

//* DELETE /api/admin/organizers/[organizerId]: delete a junk/spam applicant (204, no body)
export const deleteOrganizerParamsSchema = z.object({
  /** organizer_profiles.id of the applicant to delete. */
  organizerId: z.uuid(),
});

//* POST /api/admin/organizers/[organizerId]/reject: reject an applicant, with a reason
export const rejectOrganizerParamsSchema = z.object({
  /** organizer_profiles.id of the applicant to reject. */
  organizerId: z.uuid(),
});

export const REJECTION_REASON_MAX = 1000;

// The same schema validates the admin's reject dialog and the request on the server.
export const rejectOrganizerBodySchema = z.object({
  /** Emailed to the applicant and shown on their dashboard. */
  reason: z
    .string()
    .trim()
    .min(1, "Enter a reason so the applicant knows what to change.")
    .max(
      REJECTION_REASON_MAX,
      `Keep the reason under ${REJECTION_REASON_MAX} characters`,
    ),
});
export type RejectOrganizerBody = z.infer<typeof rejectOrganizerBodySchema>;

export const rejectOrganizerResponseSchema = z.object({
  organizerId: z.uuid(),
  organizationName: z.string(),
  organizerFirstName: z.string(),
  organizerLastName: z.string(),
  rejectedAt: z.iso.datetime(),
  /** Full name of the admin who rejected. */
  rejectedBy: z.string(),
  rejectionReason: z.string(),
  /** False if the rejection was saved but its email could not be queued. */
  rejectionEmailQueued: z.boolean(),
});
export type RejectOrganizerResponseDto = z.infer<
  typeof rejectOrganizerResponseSchema
>;

//* POST /api/admin/organizers/[organizerId]/reopen: a rejected application goes back to pending
export const reopenOrganizerParamsSchema = z.object({
  /** organizer_profiles.id of the rejected applicant to reopen. */
  organizerId: z.uuid(),
});

export const reopenOrganizerResponseSchema = z.object({
  organizerId: z.uuid(),
  organizationName: z.string(),
  organizerFirstName: z.string(),
  organizerLastName: z.string(),
  /** Always `pending` after a reopen: the admin can approve or reject again. */
  status: z.literal("pending"),
});
export type ReopenOrganizerResponseDto = z.infer<
  typeof reopenOrganizerResponseSchema
>;

//* GET /api/me/organizer-application: the signed-in organizer's own application
export const ownOrganizerApplicationResponseSchema = z.object({
  status: z.enum(organizerReviewStatuses),
  organizationName: z.string(),
  organizationWebsite: z.string().nullable(),
  /** When the application was submitted. */
  appliedAt: z.iso.datetime(),
  /** null = the applicant has not confirmed their email yet. */
  emailVerifiedAt: z.iso.datetime().nullable(),
  verifiedAt: z.iso.datetime().nullable(),
  rejectedAt: z.iso.datetime().nullable(),
  /** The admin's reason; only set when rejected. */
  rejectionReason: z.string().nullable(),
});
export type OwnOrganizerApplicationDto = z.infer<
  typeof ownOrganizerApplicationResponseSchema
>;

export const verifyOrganizerResponseSchema = z.object({
  organizerId: z.uuid(),
  organizationName: z.string(),
  organizerFirstName: z.string(),
  organizerLastName: z.string(),
  verifiedAt: z.iso.datetime(),
  /** Full name of the admin who verified. */
  verifiedBy: z.string(),
});
export type VerifyOrganizerResponseDto = z.infer<
  typeof verifyOrganizerResponseSchema
>;
