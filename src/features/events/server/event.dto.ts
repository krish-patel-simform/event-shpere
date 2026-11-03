import "server-only";
import type { EventRecord } from "../../../db/schemas";
import { blocksToText, type CmsEventPage, type CmsMedia } from "../../cms";
import type {
  EventContentDto,
  EventMediaDto,
} from "../schemas/event-content.schemas";
import type {
  EventOverviewData,
  ManagedEvent,
} from "../schemas/event-manage.schemas";
import type { EventDto } from "../schemas/events.schemas";
import { toDisplayStatus } from "../utils/event-status";
import type { ManagedEventRow, OverviewExtras } from "./event.repository";

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

/**
 * One event for the organizer's list: the row's fields one by one, the status the organizer
 * sees ("completed" is worked out from the end time), and the venue only when there is one.
 */
export function toManagedEventDto(
  row: ManagedEventRow,
  now: Date,
): ManagedEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: toDisplayStatus(row.status, row.endAt, now),
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timezone: row.timezone,
    venue:
      row.venueId && row.venueName !== null
        ? {
            id: row.venueId,
            name: row.venueName,
            city: row.venueCity ?? "",
            state: row.venueState,
          }
        : null,
    capacity: row.capacity,
    registered: row.registered,
    cancelledRegistrations: row.cancelledRegistrations,
    sessions: {
      total: row.sessionsTotal,
      scheduled: row.sessionsScheduled,
      cancelled: row.sessionsCancelled,
    },
    ticketPrice: row.ticketPrice,
  };
}

/**
 * The overview: the event plus its extra figures. A scheduled session that needs a seat is
 * full when its bookings reach the hall's seats; every other scheduled session has room.
 */
export function toEventOverviewDto(
  row: ManagedEventRow,
  extras: OverviewExtras,
  content: EventOverviewData["content"],
  now: Date,
): EventOverviewData {
  const full = extras.seatedSessions.filter(
    (session) => session.booked >= session.seats,
  );
  return {
    event: toManagedEventDto(row, now),
    content,
    hallCount: extras.hallNames.length,
    hallNames: extras.hallNames,
    speakerCount: extras.speakerCount,
    sessionBookings: extras.sessionBookings,
    sessionsWithSeatsLeft: Math.max(row.sessionsScheduled - full.length, 0),
    fullSessions: full.map((session) => ({
      id: session.id,
      title: session.title,
      seats: session.seats,
    })),
    publishedAt: iso(row.publishedAt),
  };
}

/** Picks fields one by one, so organizerId, cmsEventId and any column added later never leave by accident. */
export function toEventDto(event: EventRecord): EventDto {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    status: event.status,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    timezone: event.timezone,
    venueId: event.venueId,
    capacity: event.capacity,
    ticketPrice: event.ticketPrice,
    currency: event.currency,
    registrationOpensAt: iso(event.registrationOpensAt),
    registrationClosesAt: iso(event.registrationClosesAt),
    publishedAt: iso(event.publishedAt),
    createdAt: event.createdAt.toISOString(),
  };
}

/** Picks fields one by one: nothing Strapi adds to its answer leaves by accident. */
export function toEventMediaDto(media: CmsMedia): EventMediaDto {
  return {
    id: media.id,
    url: media.url,
    alt: media.alt,
    width: media.width,
    height: media.height,
  };
}

/**
 * The edit form's values. No page yet (an event without a CMS link) is an empty form, not an
 * error: the first save creates the page.
 */
export function toEventContentDto(page: CmsEventPage | null): EventContentDto {
  return {
    tagline: page?.tagline ?? null,
    about: page ? blocksToText(page.about) : "",
    venueGuide: page ? blocksToText(page.venueGuide) : "",
    highlights: (page?.highlights ?? []).map((item) => ({
      title: item.title ?? "",
      description: item.description ?? "",
    })),
    faqs: (page?.faqs ?? []).map((item) => ({
      question: item.question,
      answer: blocksToText(item.answer),
    })),
    seo: {
      metaTitle: page?.seo.metaTitle ?? null,
      metaDescription: page?.seo.metaDescription ?? null,
    },
    coverImage: page?.coverImage ? toEventMediaDto(page.coverImage) : null,
    gallery: (page?.gallery ?? []).map(toEventMediaDto),
  };
}
