import { z } from "zod";
import {
  sessionModeEnum,
  sessionSpeakerRoleEnum,
  sessionStatusEnum,
  sessionTypeEnum,
} from "../../../db/schemas";
import { checkSessionShape } from "../utils/session-rules";

// An ISO string with an offset, turned into a Date: "2026-12-01T10:00:00+05:30".
// A datetime-local input has NO zone, so the form must add the offset before sending.
export const isoDate = z.iso
  .datetime({
    offset: true,
    error: "Use an ISO date with a time zone offset",
  })
  .transform((value) => new Date(value));

// Who presents a session: the same list rules when a session is created and when its speakers are
// replaced. `speakerId` is a speaker PROFILE id (the database checks it exists, not this schema).
// The array order is the display order.
export const sessionSpeakersSchema = z
  .array(
    z.object({
      speakerId: z.uuid("Speaker id must be a valid id"),
      role: z.enum(sessionSpeakerRoleEnum.enumValues).default("speaker"),
    }),
  )
  .min(1, "Add at least one speaker")
  .superRefine((speakers, ctx) => {
    // The table's primary key is (session_id, speaker_id): a repeat would crash the insert.
    const seen = new Set<string>();
    speakers.forEach((speaker, index) => {
      if (seen.has(speaker.speakerId)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "speakerId"],
          message: "This speaker is added twice",
        });
      }
      seen.add(speaker.speakerId);
    });
    if (!speakers.some((speaker) => speaker.role === "speaker")) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one speaker (not only moderators)",
      });
    }
  });

//* POST /api/events/[eventId]/sessions: an organizer adds a session to their event.
// No id, eventId (it is in the URL), status, cancelledAt or cmsSessionId here: the server sets
// them, never the client. Rules that need the database (the slot is inside the event's dates,
// the hall belongs to the event's venue and is active, the hall is free, the speakers exist)
// are the service's job, not this schema's.
export const createSessionBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(255, "Title must be 255 characters or fewer"),
    type: z.enum(sessionTypeEnum.enumValues, {
      error: "Choose a session type",
    }),
    mode: z.enum(sessionModeEnum.enumValues, {
      error: "Choose how the session is attended",
    }),
    hallId: z.uuid("Hall id must be a valid id").optional(),
    onlineUrl: z
      .url({
        protocol: /^https$/,
        error: "Use a link that starts with https://",
      })
      .optional(),
    startAt: isoDate,
    endAt: isoDate,
    requiresRegistration: z.boolean().default(false),
    // Paise on top of the event ticket; 0 = included.
    price: z.number().int().min(0, "Price cannot be negative").default(0),
    speakers: sessionSpeakersSchema,
  })
  .superRefine((body, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    // Times, hall and link must fit the mode: the same rules an edit applies to the merged session.
    for (const found of checkSessionShape(body)) {
      issue([found.path], found.message);
    }
  });

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;
/** What the browser sends: dates are still ISO strings. */
export type CreateSessionRequest = z.input<typeof createSessionBodySchema>;

//* PATCH /api/events/[eventId]/sessions/[sessionId]: an organizer edits or moves a session.
// Only the fields that are sent change, and `null` clears the hall or the join link. No status,
// owner, speakers (their own API) or Strapi content (the content route) here. Whether the result
// is valid depends on the session as it is now (mode, hall, link, times), so the service applies
// the changes first and then checks the merged session with the same rules as create.
export const updateSessionBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(255, "Title must be 255 characters or fewer")
      .optional(),
    type: z
      .enum(sessionTypeEnum.enumValues, { error: "Choose a session type" })
      .optional(),
    mode: z
      .enum(sessionModeEnum.enumValues, {
        error: "Choose how the session is attended",
      })
      .optional(),
    hallId: z.uuid("Hall id must be a valid id").nullable().optional(),
    onlineUrl: z
      .url({
        protocol: /^https$/,
        error: "Use a link that starts with https://",
      })
      .nullable()
      .optional(),
    startAt: isoDate.optional(),
    endAt: isoDate.optional(),
    requiresRegistration: z.boolean().optional(),
    price: z.number().int().min(0, "Price cannot be negative").optional(),
  })
  // Unknown keys are dropped by Zod, so a body with only unknown keys ends up empty here.
  .refine(
    (body) => Object.keys(body).length > 0,
    "Send at least one field to change",
  );

export type UpdateSessionBody = z.infer<typeof updateSessionBodySchema>;
/** What the browser sends: dates are still ISO strings. */
export type UpdateSessionRequest = z.input<typeof updateSessionBodySchema>;

//* PUT /api/events/[eventId]/sessions/[sessionId]/speakers: replaces who presents the session.
// The whole list is sent: whoever is not in it is removed.
export const replaceSessionSpeakersBodySchema = z.object({
  speakers: sessionSpeakersSchema,
});
export type ReplaceSessionSpeakersBody = z.infer<
  typeof replaceSessionSpeakersBodySchema
>;
/** What the browser sends: the role may be left out (it defaults to speaker). */
export type ReplaceSessionSpeakersRequest = z.input<
  typeof replaceSessionSpeakersBodySchema
>;

//* What the API answers: one session. Times are UTC ISO strings. No Strapi id, no owner.
export const sessionSpeakerSchema = z.object({
  /** speaker_profiles.id: what the speaker list and the speakers API use. */
  speakerId: z.uuid(),
  /** The speaker's full name, so a screen needs no second lookup. */
  name: z.string(),
  role: z.enum(sessionSpeakerRoleEnum.enumValues),
  displayOrder: z.number().int().min(0),
});

export const sessionResponseSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  hallId: z.uuid().nullable(),
  /** The hall's name; null for an online session (no hall). */
  hallName: z.string().nullable(),
  title: z.string(),
  type: z.enum(sessionTypeEnum.enumValues),
  mode: z.enum(sessionModeEnum.enumValues),
  status: z.enum(sessionStatusEnum.enumValues),
  onlineUrl: z.string().nullable(),
  startAt: z.iso.datetime().nullable(),
  endAt: z.iso.datetime().nullable(),
  requiresRegistration: z.boolean(),
  /** Paise: 0 = included in the event ticket. */
  price: z.number().int().min(0),
  speakers: z.array(sessionSpeakerSchema),
});
export type SessionDto = z.infer<typeof sessionResponseSchema>;

//* GET /api/events/[eventId]/sessions: every session of one event, earliest first.
export const sessionListResponseSchema = z.array(sessionResponseSchema);

//* The URL of one session. Both ids are uuids, so a malformed id never reaches Postgres (a 500).
export const sessionParams = z.object({
  eventId: z.uuid("Event id must be a valid id"),
  sessionId: z.uuid("Session id must be a valid id"),
});
