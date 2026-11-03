import { PERMISSION } from "../../../core/auth/permission-catalog";
import type { EventRecord } from "../../../db/schemas";
import type { CmsEventPage } from "../../cms";
import {
  createEventService,
  type EventServiceDeps,
} from "../server/event.service";
import type {
  EventRef,
  ManagedEventRow,
  NewEvent,
  OverviewExtras,
} from "../server/event.repository";

// Shared by the service tests. A test file must still call jest.mock for the DB-backed modules
// (../server/event.repository, ../../cms/server, ../../organizer/server) before importing this.

export const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
export const organizerId = "5d1c3a4b-7e8f-4a1b-9c2d-3e4f5a6b7c8d";
export const venueId = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

/** The "now" of every service test, so nothing depends on the real clock. */
export const NOW = new Date("2026-11-02T10:00:00.000Z");

export const organizer = {
  id: organizerId,
  role: "organizer" as const,
  permissions: new Set<string>([PERMISSION.EVENT_MANAGE_OWN]),
};
export const otherOrganizer = {
  id: "9e8d7c6b-5a49-4382-b1a0-0f1e2d3c4b5a",
  role: "organizer" as const,
  permissions: new Set<string>([PERMISSION.EVENT_MANAGE_OWN]),
};
export const admin = {
  id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  role: "admin" as const,
  permissions: new Set<string>([PERMISSION.EVENT_MANAGE_ALL]),
};
/** A plain attendee: no event permission at all. */
export const attendee = {
  id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
  role: "user" as const,
  permissions: new Set<string>(),
};

/** What the access check reads: the organizer's draft whose Strapi page is "doc-1". */
export const eventRef: EventRef = {
  id: eventId,
  organizerId,
  status: "draft",
  cmsEventId: "doc-1",
};

/** The whole events row, for edits that compare new values with the current ones. */
export const eventRecord: EventRecord = {
  id: eventId,
  organizerId,
  title: "Fintech Product Forum",
  slug: "fintech-product-forum",
  status: "draft",
  startAt: new Date("2026-12-12T04:00:00.000Z"),
  endAt: new Date("2026-12-12T12:00:00.000Z"),
  timezone: "Asia/Kolkata",
  venueId,
  capacity: 250,
  ticketPrice: 0,
  currency: "INR",
  registrationOpensAt: null,
  registrationClosesAt: null,
  cmsEventId: "doc-1",
  publishedAt: null,
  cancelledAt: null,
  createdAt: new Date("2026-10-30T10:00:00.000Z"),
  updatedAt: new Date("2026-10-30T10:00:00.000Z"),
};

/** The same event as the list and overview read it: with venue and counted figures. */
export const managedRow: ManagedEventRow = {
  id: eventId,
  slug: "fintech-product-forum",
  title: "Fintech Product Forum",
  status: "draft",
  startAt: eventRecord.startAt,
  endAt: eventRecord.endAt,
  timezone: "Asia/Kolkata",
  capacity: 250,
  ticketPrice: 0,
  publishedAt: null,
  venueId,
  venueName: "Hotel Orchid",
  venueCity: "Pune",
  venueState: "Maharashtra",
  registered: 0,
  cancelledRegistrations: 0,
  sessionsTotal: 2,
  sessionsScheduled: 0,
  sessionsCancelled: 0,
};

export const noExtras: OverviewExtras = {
  hallNames: [],
  speakerCount: 0,
  sessionBookings: 0,
  seatedSessions: [],
};

/** A venue the organizer may pick. */
export const venue = {
  id: venueId,
  timezone: "America/New_York",
  isActive: true,
};

/** An event page with nothing written yet, as Strapi's client returns it. */
export const emptyPage: CmsEventPage = {
  documentId: "doc-1",
  tagline: null,
  about: [],
  venueGuide: [],
  coverImage: null,
  gallery: [],
  highlights: [],
  faqs: [],
  seo: { metaTitle: null, metaDescription: null },
};

/** What the repository would return for an insert. */
export function insertedRow(input: NewEvent): EventRecord {
  return {
    ...input,
    slug: "tech-conf-2026",
    status: "draft",
    publishedAt: null,
    cancelledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/**
 * The event service with every dependency mocked and a sensible answer for each call (an
 * approved organizer, their draft, an empty page, nothing registered). A test changes only what
 * it is about, e.g. `repo.countRegistered.mockResolvedValue(5)`.
 */
export function setupEventService() {
  const repo = {
    findVenue: jest.fn().mockResolvedValue(venue),
    createEvent: jest
      .fn()
      .mockImplementation(async (input: NewEvent) => insertedRow(input)),
    findEventById: jest.fn().mockResolvedValue(eventRef),
    setCmsEventId: jest.fn().mockResolvedValue(undefined),
    listOwnEvents: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    countOwnEventsByTab: jest.fn().mockResolvedValue({
      all: 0,
      draft: 0,
      published: 0,
      completed: 0,
      cancelled: 0,
    }),
    findManagedEvent: jest.fn().mockResolvedValue(managedRow),
    getOverviewExtras: jest.fn().mockResolvedValue(noExtras),
    findEventRecord: jest.fn().mockResolvedValue(eventRecord),
    countRegistered: jest.fn().mockResolvedValue(0),
    countSessionsOutside: jest.fn().mockResolvedValue(0),
    countSessionsInOtherVenue: jest.fn().mockResolvedValue(0),
    updateEvent: jest
      .fn()
      .mockImplementation(
        async (
          _id: string,
          patch: Partial<EventRecord>,
        ): Promise<EventRecord> => ({
          ...eventRecord,
          ...patch,
        }),
      ),
  };
  const strapi = {
    createEventPage: jest.fn().mockResolvedValue({ documentId: "doc-new" }),
    deleteEventPage: jest.fn().mockResolvedValue(undefined),
    findEventPageById: jest.fn().mockResolvedValue(emptyPage),
    updateEventPage: jest.fn().mockResolvedValue(emptyPage),
  };
  const media = {
    uploadFiles: jest.fn().mockResolvedValue({ ok: true, files: [] }),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };
  // An approved organizer by default; tests for the unapproved case make it throw.
  const verification = {
    assertVerifiedOrganizer: jest.fn().mockResolvedValue(undefined),
  };
  const deps: EventServiceDeps = {
    eventRepository: repo,
    strapiClient: strapi,
    mediaClient: media,
    organizerVerification: verification,
    now: () => NOW,
  };
  return {
    repo,
    strapi,
    media,
    verification,
    service: createEventService(deps),
  };
}
