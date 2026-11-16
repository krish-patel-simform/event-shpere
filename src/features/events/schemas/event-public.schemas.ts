import { z } from "zod";
import {
  sessionModeEnum,
  sessionSpeakerRoleEnum,
  sessionTypeEnum,
} from "../../../db/schemas";

// The PUBLIC side of events (discovery): what anyone, signed in or not, may see. Nothing here
// comes from the organizer's management views: no ids of Strapi files, no booking figures, no
// capacity (only the seats left), no join links. The organizer's own routes keep their own
// schemas (event-manage.schemas.ts).

//* GET /api/events: the events anyone can browse. Only published events are listed: never drafts,
// never cancelled ones. Postgres decides which and in what order; Strapi adds the card's tagline
// and banner.

export const publicEventSorts = [
  "soonest",
  "latest",
  "price_asc",
  "price_desc",
  "popular",
] as const;
export type PublicEventSort = (typeof publicEventSorts)[number];

/** Events that have not ended yet (the default), or the ones that have. */
export const publicEventWhens = ["upcoming", "past"] as const;
export type PublicEventWhen = (typeof publicEventWhens)[number];

export const publicEventPrices = ["free", "paid"] as const;
export type PublicEventPrice = (typeof publicEventPrices)[number];

export const publicEventListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  /** Part of the title, case-insensitive. Empty = no filter. */
  search: z.string().trim().max(100).optional(),
  /** Free (price 0) or paid; left out = both. */
  price: z.enum(publicEventPrices).optional(),
  when: z.enum(publicEventWhens).default("upcoming"),
  sort: z.enum(publicEventSorts).default("soonest"),
});
export type PublicEventListQuery = z.infer<typeof publicEventListQuerySchema>;

/** An image from the CMS, as the public sees it: no Strapi file id. */
export const publicMediaSchema = z.object({
  url: z.string(),
  alt: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});
export type PublicMediaDto = z.infer<typeof publicMediaSchema>;

export const publicEventListItemSchema = z.object({
  /** The public link of the event: /events/[slug]. */
  slug: z.string(),
  title: z.string(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  /** IANA zone the dates and times are shown in (the venue's). */
  timezone: z.string(),
  venue: z
    .object({
      name: z.string(),
      city: z.string(),
      state: z.string().nullable(),
    })
    .nullable(),
  /** Paise: 0 = free. */
  ticketPrice: z.number().int().min(0),
  /** Seats not taken yet; null = no limit. */
  seatsLeft: z.number().int().min(0).nullable(),
  /** From the CMS: null when the organizer wrote none, or the CMS did not answer. */
  tagline: z.string().nullable(),
  coverImage: publicMediaSchema.nullable(),
});
export type PublicEventListItemDto = z.infer<typeof publicEventListItemSchema>;

// `data` of the list response (pagination `meta` is sent next to it).
export const publicEventListResponseSchema = z.array(publicEventListItemSchema);

//* GET /api/events/slug/[slug]: one event's public page. A published event, or a cancelled one
// (it stays visible with a cancelled banner); a draft or an unknown slug is a 404.

export const publicEventSlugParam = z.object({
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid event"),
});

export const publicSessionSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  type: z.enum(sessionTypeEnum.enumValues),
  mode: z.enum(sessionModeEnum.enumValues),
  startAt: z.iso.datetime().nullable(),
  endAt: z.iso.datetime().nullable(),
  /** null for an online session (no hall). The join link is never public. */
  hallName: z.string().nullable(),
  /** Paise on top of the event ticket; 0 = included. */
  price: z.number().int().min(0),
  requiresRegistration: z.boolean(),
  speakers: z.array(
    z.object({
      /** For the link to the speaker's public page. */
      slug: z.string(),
      name: z.string(),
      role: z.enum(sessionSpeakerRoleEnum.enumValues),
    }),
  ),
});
export type PublicSessionDto = z.infer<typeof publicSessionSchema>;

export const publicEventContentSchema = z.object({
  tagline: z.string().nullable(),
  /** Plain text: a blank line starts a new paragraph. */
  about: z.string(),
  venueGuide: z.string(),
  highlights: z.array(z.object({ title: z.string(), description: z.string() })),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  seo: z.object({
    metaTitle: z.string().nullable(),
    metaDescription: z.string().nullable(),
  }),
  coverImage: publicMediaSchema.nullable(),
  gallery: z.array(publicMediaSchema),
});
export type PublicEventContentDto = z.infer<typeof publicEventContentSchema>;

export const publicEventDetailSchema = z.object({
  slug: z.string(),
  title: z.string(),
  /** A cancelled event stays visible: its page shows a cancelled banner. */
  status: z.enum(["published", "cancelled"]),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  timezone: z.string(),
  venue: z
    .object({
      name: z.string(),
      addressLine: z.string(),
      city: z.string(),
      state: z.string().nullable(),
      postalCode: z.string().nullable(),
    })
    .nullable(),
  ticketPrice: z.number().int().min(0),
  /** Seats not taken yet; null = no limit. */
  seatsLeft: z.number().int().min(0).nullable(),
  registrationOpensAt: z.iso.datetime().nullable(),
  registrationClosesAt: z.iso.datetime().nullable(),
  /**
   * The page content from the CMS. null = the CMS did not answer: the page still shows the
   * facts above, and says the rest is coming.
   */
  content: publicEventContentSchema.nullable(),
  /** Scheduled sessions only, earliest first. */
  sessions: z.array(publicSessionSchema),
});
export type PublicEventDetailDto = z.infer<typeof publicEventDetailSchema>;
