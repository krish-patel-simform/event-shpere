import { z } from "zod";
import { userStatusEnum } from "../../../db/schemas";

// POST /api/admin/organizers: what the admin fills in.
export const createOrganizerBodySchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  // users.email is stored lowercase (check constraint).
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(255)),
  organizationName: z.string().trim().min(1, "Organization name is required").max(255),
  // http(s) only: a "javascript:" URL here would later end up in a link on the site.
  organizationWebsite: z
    .url({ protocol: /^https?$/, message: "Use a full http(s) URL" })
    .optional(),
});
export type CreateOrganizerBody = z.infer<typeof createOrganizerBodySchema>;

export const organizerResponseSchema = z.object({
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
export type OrganizerDto = z.infer<typeof organizerResponseSchema>;
