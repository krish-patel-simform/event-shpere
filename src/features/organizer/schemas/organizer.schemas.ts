import { z } from "zod";
import { roleNameEnum, userStatusEnum } from "../../../db/schemas";

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

// The form's own schema. An empty website box is "" (= no website), which the API schema would
// reject as a bad URL, so here "" is allowed and the form turns it into "left out" on submit.
export const createOrganizerFormSchema = createOrganizerBodySchema.extend({
  organizationWebsite: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        createOrganizerBodySchema.shape.organizationWebsite.safeParse(value)
          .success,
      "Use a full http(s) URL, for example https://acme.com",
    ),
});
export type CreateOrganizerFormValues = z.input<
  typeof createOrganizerFormSchema
>;

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

// The ONLY ways the list can be sorted. Never build ORDER BY from a string in the URL: this
// whitelist stops it. The date used depends on the list (see `sortColumns` in
// organizer.repository.ts): applied for the waiting list, approved for `verified`, rejected for
// `rejected`. To add a sort: add it here AND to `sortOrders` in the repository.
export const organizerSorts = ["newest", "oldest"] as const;
export type OrganizerSort = (typeof organizerSorts)[number];

// Every filter is optional: without them the list is not filtered. Missing keys arrive as
// undefined (parseQuery reads the URL into an object), so .optional() is enough.
export const organizerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50),
  /** Matches organisation name, applicant name (first, last or full) or email. */
  search: z.string().trim().max(100).optional(),
  verification: z.enum(organizerVerificationFilters).optional(),
  /**
   * The applicant has (true) or has not (false) confirmed their email. Sent as the text
   * "true" / "false": z.coerce.boolean() would turn "false" into true.
   */
  emailVerified: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  sort: z.enum(organizerSorts).default("newest"),
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

//* GET /api/admin/organizers/[organizerId]: one application, for the review page
export const getOrganizerParamsSchema = z.object({
  /** organizer_profiles.id of the application to read. */
  organizerId: z.uuid(),
});

export const organizerDetailResponseSchema = z.object({
  /** organizer_profiles.id */
  id: z.uuid(),
  organizationName: z.string(),
  organizationWebsite: z.string().nullable(),
  /** When the application came in. */
  appliedAt: z.iso.datetime(),
  status: z.enum(organizerReviewStatuses),
  /** When it was approved; null unless approved. */
  approvedAt: z.iso.datetime().nullable(),
  /** When it was rejected; null unless rejected. */
  rejectedAt: z.iso.datetime().nullable(),
  /** What the applicant was told; null unless rejected. */
  rejectionReason: z.string().nullable(),
  /** Another organizer already uses this organisation name or website. */
  hasDuplicate: z.boolean(),
  /** The person who applied. Admin-only route: the admin needs these to decide. */
  applicant: z.object({
    userId: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    /** When they confirmed their email; null = not yet (approving needs it). */
    emailVerifiedAt: z.iso.datetime().nullable(),
    accountStatus: z.enum(userStatusEnum.enumValues),
    /** One role per user; null for an account that has none. */
    role: z.enum(roleNameEnum.enumValues).nullable(),
    createdAt: z.iso.datetime(),
  }),
});
export type OrganizerDetailDto = z.infer<typeof organizerDetailResponseSchema>;

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
