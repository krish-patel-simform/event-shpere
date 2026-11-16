import { z } from "zod";

//* What the organizer's list and overview show. One contract for the server (it parses what it
// sends) and the browser (it parses what it receives).

/**
 * The status the organizer sees. The database only stores draft, published and cancelled.
 * "completed" is worked out: a published event whose end time has passed (end_at < now).
 * A completed event is read-only: it can no longer be edited or cancelled.
 */
export const eventDisplayStatusSchema = z.enum([
  "draft",
  "published",
  "completed",
  "cancelled",
]);
export type EventDisplayStatus = z.infer<typeof eventDisplayStatusSchema>;

/** One event as the organizer's list and overview need it. Times are UTC ISO strings. */
export const managedEventSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  status: eventDisplayStatusSchema,
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  /** IANA zone the dates and times are shown in (the venue's). */
  timezone: z.string(),
  venue: z
    .object({
      id: z.uuid(),
      name: z.string(),
      city: z.string(),
      /** The venue's state name; null for an old venue that has none. */
      state: z.string().nullable(),
    })
    .nullable(),
  /** null = no limit. */
  capacity: z.number().int().nullable(),
  registered: z.number().int().min(0),
  /** Registrations that were cancelled (when the event was cancelled, or by the attendee). */
  cancelledRegistrations: z.number().int().min(0),
  sessions: z.object({
    total: z.number().int().min(0),
    scheduled: z.number().int().min(0),
    cancelled: z.number().int().min(0),
  }),
  /** Paise: 150000 = ₹1,500. 0 = free. */
  ticketPrice: z.number().int().min(0),
});
export type ManagedEvent = z.infer<typeof managedEventSchema>;

//* GET /api/me/events: the organizer's own events, one page, by status tab.

export const eventTabs = [
  "all",
  "draft",
  "published",
  "completed",
  "cancelled",
] as const;
export type EventTabKey = (typeof eventTabs)[number];

export const eventSorts = ["soonest", "latest"] as const;
export type EventSort = (typeof eventSorts)[number];

export const myEventListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  /** The tab: one status, or every event. */
  status: z.enum(eventTabs).default("all"),
  /** Matches the title (contains, ignoring case). */
  search: z.string().trim().max(100).optional(),
  /** By start date: the next event first, or the furthest. */
  sort: z.enum(eventSorts).default("soonest"),
});
export type MyEventListQuery = z.infer<typeof myEventListQuerySchema>;

export const myEventListResponseSchema = z.array(managedEventSchema);

//* GET /api/me/events/counts: how many events each tab holds (whatever the search).

export const eventTabCountsSchema = z.object({
  all: z.number().int().min(0),
  draft: z.number().int().min(0),
  published: z.number().int().min(0),
  completed: z.number().int().min(0),
  cancelled: z.number().int().min(0),
});
export type EventTabCounts = z.infer<typeof eventTabCountsSchema>;

//* GET /api/events/[eventId]: one event with the figures its overview page shows.

/** A scheduled session that has no seats left. */
export const fullSessionSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  seats: z.number().int().min(0),
});
export type FullSession = z.infer<typeof fullSessionSchema>;

export const eventOverviewSchema = z.object({
  event: managedEventSchema,
  /**
   * What the event page (Strapi) holds, to tell what is missing before publishing. null = the
   * CMS did not answer: the overview still loads, and the checklist says it could not check.
   */
  content: z
    .object({ hasDescription: z.boolean(), hasBanner: z.boolean() })
    .nullable(),
  hallCount: z.number().int().min(0),
  hallNames: z.array(z.string()),
  speakerCount: z.number().int().min(0),
  /** Seat bookings on sessions, across the event. */
  sessionBookings: z.number().int().min(0),
  /** Scheduled sessions that still have seats left. */
  sessionsWithSeatsLeft: z.number().int().min(0),
  fullSessions: z.array(fullSessionSchema),
  /** ISO time the event was published, or null for a draft. */
  publishedAt: z.iso.datetime().nullable(),
});
export type EventOverviewData = z.infer<typeof eventOverviewSchema>;
