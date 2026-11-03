import type { StateDto } from "@/src/features/locations";
import type {
  EventOverviewData,
  ManagedEvent,
  VenueOption,
} from "../types/event-manage.types";

// Example answers of the events API, for the tests of the organizer's screens. Ids are fixed so
// the list, the overview and the edit form agree on which event is which.

/** The "current time" of the samples, so nothing here depends on the real clock. */
export const SAMPLE_NOW = "2026-11-02T10:00:00.000Z";

/**
 * The states of the sample venues' form. The real list comes from GET /api/states (every state
 * and union territory); a few are enough here, one of them (Kerala) with no venue on purpose.
 */
export const SAMPLE_STATES: readonly StateDto[] = [
  { id: "5c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e01", name: "Delhi", code: "IN-DL" },
  { id: "5c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e02", name: "Goa", code: "IN-GA" },
  {
    id: "5c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e03",
    name: "Gujarat",
    code: "IN-GJ",
  },
  {
    id: "5c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e04",
    name: "Karnataka",
    code: "IN-KA",
  },
  { id: "5c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e05", name: "Kerala", code: "IN-KL" },
  {
    id: "5c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e06",
    name: "Maharashtra",
    code: "IN-MH",
  },
  {
    id: "5c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e07",
    name: "Tamil Nadu",
    code: "IN-TN",
  },
];

/**
 * The active venues an organizer can pick. Each carries its state's name: the form picks the
 * state first and then lists only that state's venues. With the API that list is
 * GET /api/venues?state=…&status=active.
 */
export const SAMPLE_VENUES: readonly VenueOption[] = [
  {
    id: "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d01",
    name: "Convention Centre",
    city: "Pune",
    state: "Maharashtra",
    addressLine: "Plot 4, Senapati Bapat Road, Pune 411016",
    hallCount: 4,
    timezone: "Asia/Kolkata",
  },
  {
    id: "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d02",
    name: "Tech Park Auditorium",
    city: "Pune",
    state: "Maharashtra",
    addressLine: "Rajiv Gandhi Infotech Park, Hinjewadi, Pune 411057",
    hallCount: 1,
    timezone: "Asia/Kolkata",
  },
  {
    id: "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d03",
    name: "Hotel Orchid",
    city: "Pune",
    state: "Maharashtra",
    addressLine: "Plot 12, Baner Road, Pune 411045",
    hallCount: 2,
    timezone: "Asia/Kolkata",
  },
  {
    id: "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d04",
    name: "Harbour View Hotel & Events",
    city: "Mumbai",
    state: "Maharashtra",
    addressLine: "Marine Drive, Mumbai 400020",
    hallCount: 3,
    timezone: "Asia/Kolkata",
  },
  {
    id: "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d05",
    name: "Co-working Hub",
    city: "Pune",
    state: "Maharashtra",
    addressLine: "Koregaon Park, Pune 411001",
    hallCount: 1,
    timezone: "Asia/Kolkata",
  },
  {
    id: "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d06",
    name: "Orchard Tech Park Auditorium",
    city: "Bengaluru",
    state: "Karnataka",
    addressLine: "Outer Ring Road, Marathahalli, Bengaluru 560037",
    hallCount: 2,
    timezone: "Asia/Kolkata",
  },
  {
    id: "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d07",
    name: "GIFT City Convention Centre",
    city: "Gandhinagar",
    state: "Gujarat",
    addressLine: "Block 12, Zone 1, GIFT City, Gandhinagar 382355",
    hallCount: 2,
    timezone: "Asia/Kolkata",
  },
  {
    id: "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d08",
    name: "Beach Road Convention Hall",
    city: "Panaji",
    state: "Goa",
    addressLine: "Miramar Beach Road, Panaji 403001",
    hallCount: 1,
    timezone: "Asia/Kolkata",
  },
];

const venueRef = (index: number) => {
  const { id, name, city, state } = SAMPLE_VENUES[index];
  return { id, name, city, state };
};

export const SUMMIT_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
export const DESIGN_DAY_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f02";
export const FINTECH_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f03";
export const MEETUP_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f04";
export const FUTURES_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f05";

export const SAMPLE_EVENTS: readonly ManagedEvent[] = [
  {
    id: SUMMIT_ID,
    slug: "product-engineering-summit-2026",
    title: "Product Engineering Summit 2026",
    status: "published",
    startAt: "2026-12-03T03:30:00.000Z",
    endAt: "2026-12-05T12:30:00.000Z",
    timezone: "Asia/Kolkata",
    venue: venueRef(0),
    capacity: 600,
    registered: 480,
    cancelledRegistrations: 0,
    sessions: { total: 24, scheduled: 22, cancelled: 0 },
    ticketPrice: 0,
  },
  {
    id: DESIGN_DAY_ID,
    slug: "design-systems-engineering-day",
    title: "Design Systems Engineering Day",
    status: "published",
    startAt: "2026-11-14T03:30:00.000Z",
    endAt: "2026-11-14T12:00:00.000Z",
    timezone: "Asia/Kolkata",
    venue: venueRef(1),
    capacity: 200,
    registered: 188,
    cancelledRegistrations: 0,
    sessions: { total: 9, scheduled: 9, cancelled: 0 },
    ticketPrice: 49900,
  },
  {
    id: FINTECH_ID,
    slug: "fintech-product-forum",
    title: "Fintech Product Forum",
    status: "draft",
    startAt: "2026-12-12T04:00:00.000Z",
    endAt: "2026-12-12T12:00:00.000Z",
    timezone: "Asia/Kolkata",
    venue: venueRef(2),
    capacity: 250,
    registered: 0,
    cancelledRegistrations: 0,
    sessions: { total: 2, scheduled: 0, cancelled: 0 },
    ticketPrice: 0,
  },
  {
    id: MEETUP_ID,
    slug: "pune-tech-meetup",
    title: "Pune Tech Meetup",
    status: "cancelled",
    startAt: "2026-10-12T12:30:00.000Z",
    endAt: "2026-10-12T15:30:00.000Z",
    timezone: "Asia/Kolkata",
    venue: venueRef(4),
    capacity: 120,
    registered: 0,
    cancelledRegistrations: 86,
    sessions: { total: 4, scheduled: 0, cancelled: 4 },
    ticketPrice: 0,
  },
  {
    id: FUTURES_ID,
    slug: "frontend-futures-2026",
    title: "Frontend Futures 2026",
    status: "completed",
    startAt: "2026-09-14T03:30:00.000Z",
    endAt: "2026-09-14T12:30:00.000Z",
    timezone: "Asia/Kolkata",
    venue: venueRef(0),
    capacity: 450,
    registered: 420,
    cancelledRegistrations: 0,
    sessions: { total: 16, scheduled: 16, cancelled: 0 },
    ticketPrice: 99900,
  },
];

/** Figures only the overview needs, for the events that have more than the defaults. */
const OVERVIEW_EXTRAS: Record<string, Partial<EventOverviewData>> = {
  [SUMMIT_ID]: {
    hallCount: 4,
    hallNames: ["Main Hall", "Hall B", "Workshop Room", "Studio"],
    speakerCount: 14,
    sessionBookings: 1286,
    sessionsWithSeatsLeft: 21,
    fullSessions: [
      {
        id: "9d0e1f2a-3b4c-4d5e-8f60-718293a4b5c6",
        title: "Hands-on: Type-safe APIs with TypeScript and Zod",
        seats: 60,
      },
    ],
    publishedAt: "2026-09-12T08:00:00.000Z",
  },
  [FINTECH_ID]: {
    content: { hasDescription: false, hasBanner: false },
    hallCount: 2,
    hallNames: ["Hall 1", "Hall 2"],
    speakerCount: 2,
    publishedAt: null,
  },
};

/** The overview of a listed event: its figures from the list plus the extras, or null if unknown. */
export function findSampleOverview(
  eventId: string,
  events: readonly ManagedEvent[] = SAMPLE_EVENTS,
): EventOverviewData | null {
  const event = events.find((item) => item.id === eventId);
  if (!event) return null;

  return {
    event,
    content: { hasDescription: true, hasBanner: true },
    hallCount: 2,
    hallNames: ["Hall A", "Hall B"],
    speakerCount: 6,
    sessionBookings: event.registered * 2,
    sessionsWithSeatsLeft: event.sessions.scheduled,
    fullSessions: [],
    publishedAt: event.status === "draft" ? null : "2026-09-01T08:00:00.000Z",
    ...OVERVIEW_EXTRAS[event.id],
  };
}
