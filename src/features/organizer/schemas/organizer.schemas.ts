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

// Search is optional: without both searchField and searchValue the list is not filtered.
export const organizerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50),
  searchField: z.enum(organizerSearchFields).nullish(),
  searchValue: z.string().trim().max(100).nullish(),
});

export type ListOrganizersQuery = z.infer<typeof organizerQuerySchema>;
// One row of the list.
const organizerListItemSchema = z.object({
  /** organizer_profiles.id: what the admin sends to verify this organizer. */
  id: z.uuid(),
  /** The organizer (the person), from users. */
  organizerFirstName: z.string(),
  organizerLastName: z.string(),
  organizationName: z.string(),
  organizationWebsite: z.string().nullable(),
  /** null = not verified yet. */
  verifiedAt: z.iso.datetime().nullable(),
  /** Full name of the admin who verified; null = not verified yet. */
  verifiedBy: z.string().nullable(),
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
