import { z } from "zod";
import { userStatusEnum } from "../../../db/schemas";
import { emailSchema } from "../../auth";
import { strapiBlocksSchema } from "../../cms";

//* POST /api/speakers: an organizer (or admin) invites a speaker.
// No slug, status or createdBy here: the server sets them, never the client.
export const createSpeakerBodySchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: emailSchema,
});
export type CreateSpeakerBody = z.infer<typeof createSpeakerBodySchema>;

export const createSpeakerResponseSchema = z.object({
  /** speaker_profiles.id */
  id: z.uuid(),
  userId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  /** `pending` until the speaker sets a password from the email. */
  status: z.enum(userStatusEnum.enumValues),
  /** Public profile URL part, e.g. "ankit-sharma-3f9a1c". */
  slug: z.string(),
  createdAt: z.iso.datetime(),
  /** False if the account was created but the setup email could not be queued. */
  setupEmailQueued: z.boolean(),
});
export type CreateSpeakerResponseDto = z.infer<
  typeof createSpeakerResponseSchema
>;

/**
 * `error.details` of a 409 SPEAKER_EXISTS: the speaker who already has this email, so the UI
 * can show them instead of creating a duplicate. Basic Postgres data only (no createdBy, no
 * CMS ids): the speaker may have been invited by another organizer.
 */
export const existingSpeakerSchema = z.object({
  /** speaker_profiles.id */
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  slug: z.string(),
  /** `pending` = invited, has not set a password yet. */
  status: z.enum(userStatusEnum.enumValues),
});
export type ExistingSpeakerDto = z.infer<typeof existingSpeakerSchema>;

export const speakerExistsDetailsSchema = z.object({
  speaker: existingSpeakerSchema,
});
export type SpeakerExistsDetails = z.infer<typeof speakerExistsDetailsSchema>;

// ---------- public reads (SPK-1, SPK-2): no email, status or internal ids ----------

// http(s) only: a "javascript:" URL here would end up in a link or <img> on the site.
const httpUrlSchema = z.url({ protocol: /^https?$/ });

const speakerPhotoSchema = z.object({
  url: httpUrlSchema,
  /** From the CMS, or the speaker's name when the CMS has none. */
  alt: z.string(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

/** What the list card needs (SPK-1). */
const speakerSummarySchema = z.object({
  photo: speakerPhotoSchema.nullable(),
  /** "Designation" in the spec. */
  jobTitle: z.string().nullable(),
  company: z.string().nullable(),
});

//* GET /api/speakers
export const listSpeakersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(5),
  /** Part of the speaker's name, case-insensitive. Empty = no filter. */
  search: z.string().trim().max(100).optional(),
});
export type ListSpeakersQuery = z.infer<typeof listSpeakersQuerySchema>;

export const speakerListItemSchema = z.object({
  slug: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  /** null = no CMS content right now (Strapi unreachable or entry missing): show the name only. */
  profile: speakerSummarySchema
    .extend({
      /** The topics on the card; the same ones the profile shows. */
      expertise: z.array(z.string()),
    })
    .nullable(),
});
export type SpeakerListItemDto = z.infer<typeof speakerListItemSchema>;

// `data` of the list response (pagination `meta` is sent next to it).
export const getSpeakersResponseSchema = z.array(speakerListItemSchema);

//* GET /api/speakers/[slug]
export const speakerSlugParamsSchema = z.object({
  // Same shape createSpeakerSlug makes: checked before it reaches the DB.
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid speaker"),
});
export type SpeakerSlugParams = z.infer<typeof speakerSlugParamsSchema>;

export const speakerProfileResponseSchema = z.object({
  slug: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  /** null = no CMS content right now: show the name and "Profile coming soon". */
  profile: speakerSummarySchema
    .extend({
      /** Strapi blocks rich text; empty array = no bio yet. */
      bio: strapiBlocksSchema,
      expertise: z.array(z.string()),
      links: z.object({
        linkedin: httpUrlSchema.nullable(),
        twitter: httpUrlSchema.nullable(),
        website: httpUrlSchema.nullable(),
      }),
    })
    .nullable(),
  // Sessions (SPK-2) are added once the sessions table exists.
});
export type SpeakerProfileDto = z.infer<typeof speakerProfileResponseSchema>;

// ---------- the speaker's own profile (/api/me/speaker-profile): one edit form ----------

/**
 * Optional text a speaker can clear. PATCH meaning:
 * undefined = leave as is, null or "" = clear it, text = set it.
 */
const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

/** Same three states, for links: http(s) only, checked on input as well as on output. */
const clearableLink = z
  .string()
  .trim()
  .max(255)
  .transform((value) => value || null)
  .pipe(httpUrlSchema.nullable())
  .nullable()
  .optional();

//* PATCH /api/me/speaker-profile: only the fields that changed
// Not editable here (Zod drops them): email, slug, status, photo, any id.
export const updateOwnSpeakerProfileBodySchema = z
  .object({
    // Names can be changed, not cleared.
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(100)
      .optional(),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(100)
      .optional(),
    jobTitle: clearableText(100),
    company: clearableText(120),
    /** Plain text; blank lines separate paragraphs. Stored as Strapi blocks. */
    bio: clearableText(5000),
    /** The whole list (send [] to clear). Duplicates are removed, case-insensitively. */
    expertise: z
      .array(z.string().trim().min(1).max(40))
      .max(10, "Add up to 10 topics")
      .transform((topics) =>
        topics.filter(
          (topic, index) =>
            topics.findIndex((t) => t.toLowerCase() === topic.toLowerCase()) ===
            index,
        ),
      )
      .optional(),
    linkedinUrl: clearableLink,
    twitterUrl: clearableLink,
    websiteUrl: clearableLink,
  })
  .refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    "Nothing to update",
  );
/** What the form sends (before trimming/defaults). */
export type UpdateOwnSpeakerProfileInput = z.input<
  typeof updateOwnSpeakerProfileBodySchema
>;
/** What the server works with after parsing. */
export type UpdateOwnSpeakerProfileBody = z.infer<
  typeof updateOwnSpeakerProfileBodySchema
>;

//* GET + PATCH /api/me/speaker-profile: the form's values (editable shape, not the public one)
export const ownSpeakerProfileResponseSchema = z.object({
  /** Read-only here: shows the speaker where their public page is. */
  slug: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  jobTitle: z.string().nullable(),
  company: z.string().nullable(),
  /** Plain text for the textarea ("" = no bio yet). */
  bio: z.string(),
  expertise: z.array(z.string()),
  /** As stored, so the speaker sees exactly what is saved. */
  linkedinUrl: z.string().nullable(),
  twitterUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  photo: speakerPhotoSchema.nullable(),
});
export type OwnSpeakerProfileDto = z.infer<
  typeof ownSpeakerProfileResponseSchema
>;

//* POST /api/me/speaker-profile/photo
export const speakerPhotoResponseSchema = z.object({
  photo: speakerPhotoSchema,
});
export type SpeakerPhotoResponseDto = z.infer<
  typeof speakerPhotoResponseSchema
>;
