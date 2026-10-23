import { z } from "zod";

//* POST {STRAPI_URL}/api/eventsphere/organizer-access (server to server, never from a browser)

/** What we send: the organizer the Strapi admin-panel account is for. */
export const organizerAccessRequestSchema = z.object({
  email: z.email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});
export type OrganizerAccessRequest = z.infer<
  typeof organizerAccessRequestSchema
>;

/** What Strapi answers. Parsed, because a changed Strapi could answer anything. */
export const organizerAccessResponseSchema = z.object({
  data: z.object({
    /** Strapi admin user id (an integer, not a uuid). */
    id: z.number().int().positive(),
    /**
     * One-time secret of the register link. null = the organizer already registered.
     * As sensitive as a password-setup link: never log it or return it from our API.
     */
    registrationToken: z.string().min(1).nullable(),
  }),
});
export type OrganizerAccess = z.infer<
  typeof organizerAccessResponseSchema
>["data"];
