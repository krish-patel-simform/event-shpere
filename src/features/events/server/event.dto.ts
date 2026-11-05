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
import type {
  PublicEventDetailDto,
  PublicEventListItemDto,
  PublicMediaDto,
} from "../schemas/event-public.schemas";
import type { EventDto } from "../schemas/events.schemas";
import { toDisplayStatus } from "../utils/event-status";
import type {
  ManagedEventRow,
  OverviewExtras,
  PublicEventRow,
  PublicSessionRow,
} from "./event.repository";

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

//* The public side (discovery). Every field is picked by hand: nothing the organizer's views
//* hold (ids, capacity, booking figures, Strapi file ids, join links) reaches the public.

/** An image for the public: its address and size, never the Strapi file id. */
export function toPublicMediaDto(media: CmsMedia): PublicMediaDto {
  return {
    url: media.url,
    alt: media.alt,
    width: media.width,
    height: media.height,
  };
}

/** Seats not taken yet. null = no limit; never below 0 (bookings can exceed a lowered capacity). */
export function seatsLeft(
  capacity: number | null,
  registered: number,
): number | null {
  return capacity === null ? null : Math.max(capacity - registered, 0);
}

/** One card of the public list. `page` is the event's CMS page, null when there is none. */
export function toPublicEventListItemDto(
  row: ManagedEventRow,
  page: CmsEventPage | null,
): PublicEventListItemDto {
  return {
    slug: row.slug,
    title: row.title,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timezone: row.timezone,
    venue:
      row.venueName !== null
        ? {
            name: row.venueName,
            city: row.venueCity ?? "",
            state: row.venueState,
          }
        : null,
    ticketPrice: row.ticketPrice,
    seatsLeft: seatsLeft(row.capacity, row.registered),
    tagline: page?.tagline ?? null,
    coverImage: page?.coverImage ? toPublicMediaDto(page.coverImage) : null,
  };
}

/**
 * The event's public page: the event's facts from Postgres, the written content from the CMS
 * (null content = the CMS did not answer, so the facts still show) and its scheduled sessions.
 */
export function toPublicEventDetailDto(
  row: PublicEventRow,
  page: CmsEventPage | null,
  sessions: PublicSessionRow[],
): PublicEventDetailDto {
  return {
    slug: row.slug,
    title: row.title,
    // The query only finds these two; a draft never gets here.
    status: row.status === "cancelled" ? "cancelled" : "published",
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timezone: row.timezone,
    venue:
      row.venueName !== null && row.venueAddressLine !== null
        ? {
            name: row.venueName,
            addressLine: row.venueAddressLine,
            city: row.venueCity ?? "",
            state: row.venueState,
            postalCode: row.venuePostalCode,
          }
        : null,
    ticketPrice: row.ticketPrice,
    seatsLeft: seatsLeft(row.capacity, row.registered),
    registrationOpensAt: iso(row.registrationOpensAt),
    registrationClosesAt: iso(row.registrationClosesAt),
    content: page
      ? {
          tagline: page.tagline,
          about: blocksToText(page.about),
          venueGuide: blocksToText(page.venueGuide),
          highlights: page.highlights.map((item) => ({
            title: item.title ?? "",
            description: item.description ?? "",
          })),
          faqs: page.faqs.map((item) => ({
            question: item.question,
            answer: blocksToText(item.answer),
          })),
          seo: {
            metaTitle: page.seo.metaTitle,
            metaDescription: page.seo.metaDescription,
          },
          coverImage: page.coverImage
            ? toPublicMediaDto(page.coverImage)
            : null,
          gallery: page.gallery.map(toPublicMediaDto),
        }
      : null,
    sessions: sessions.map((session) => ({
      id: session.id,
      title: session.title,
      type: session.type,
      mode: session.mode,
      startAt: iso(session.startAt),
      endAt: iso(session.endAt),
      hallName: session.hallName,
      price: session.price,
      requiresRegistration: session.requiresRegistration,
      speakers: session.speakers.map((speaker) => ({
        slug: speaker.slug,
        name: `${speaker.firstName} ${speaker.lastName}`,
        role: speaker.role,
      })),
    })),
  };
}
