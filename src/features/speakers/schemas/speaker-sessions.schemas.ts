import { z } from "zod";
import { sessionModeEnum, sessionTypeEnum } from "../../../db/schemas";
import { speakerSlugParamsSchema } from "./speaker.schemas";

//* GET /api/speakers/[slug]/sessions?timeline=now|upcoming|past: the sessions on a speaker's public
// page, one category per request, grouped by event. Open to anyone; no booking figures except the
// seats left, no join links, nothing from the CMS.

export const speakerSessionParams = speakerSlugParamsSchema;

/** `now` = started, not over yet · `upcoming` = starts later · `past` = already over. */
export const speakerSessionTimelines = ["now", "upcoming", "past"] as const;
export type SpeakerSessionTimeline = (typeof speakerSessionTimelines)[number];

export const listSpeakerSessionsQuerySchema = z.object({
  timeline: z.enum(speakerSessionTimelines).default("upcoming"),
  page: z.coerce.number().int().min(1).default(1),
  /** Events per page (a page holds whole events, with all the speaker's sessions in them). */
  pageSize: z.coerce.number().int().min(1).max(20).default(5),
});
export type ListSpeakerSessionsQuery = z.infer<
  typeof listSpeakerSessionsQuerySchema
>;

export const speakerSessionSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  type: z.enum(sessionTypeEnum.enumValues),
  mode: z.enum(sessionModeEnum.enumValues),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  /** null for an online session (no hall). */
  hallName: z.string().nullable(),
  /** Paise on top of the event ticket; 0 = included. */
  price: z.number().int().min(0),
  requiresRegistration: z.boolean(),
  /** Hall seats minus bookings; null when the session needs no booking. */
  seatsLeft: z.number().int().min(0).nullable(),
});
export type SpeakerSessionDto = z.infer<typeof speakerSessionSchema>;

export const speakerSessionGroupSchema = z.object({
  event: z.object({
    slug: z.string(),
    title: z.string(),
    startAt: z.iso.datetime(),
    endAt: z.iso.datetime(),
    /** IANA zone the times are shown in. */
    timezone: z.string(),
    venue: z.object({ name: z.string(), city: z.string() }).nullable(),
    /** Paise: 0 = free. */
    ticketPrice: z.number().int().min(0),
  }),
  /** Only this speaker's sessions in the category, earliest first. */
  sessions: z.array(speakerSessionSchema).min(1),
});
export type SpeakerSessionGroupDto = z.infer<typeof speakerSessionGroupSchema>;

// `data` of the response; the paging `meta` is sent next to it.
export const speakerSessionsResponseSchema = z.array(speakerSessionGroupSchema);

/** The usual paging meta (`total` = events) plus every session in the category, not just this page. */
export const speakerSessionsMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalSessions: z.number().int().min(0),
});
export type SpeakerSessionsMeta = z.infer<typeof speakerSessionsMetaSchema>;
