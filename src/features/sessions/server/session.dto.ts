import "server-only";
import { blocksToText, type CmsMedia, type CmsSessionDetail } from "../../cms";
import { toPublicMediaDto } from "../../events/server";
import type {
  SessionContentDto,
  SessionCoverDto,
} from "../schemas/session-content.schemas";
import type {
  PublicSessionContentDto,
  PublicSessionDetailDto,
} from "../schemas/session-public.schemas";
import type { SessionDto } from "../schemas/sessions.schemas";
import type {
  PublicSessionRow,
  SessionWithSpeakers,
} from "./session.repository";

/**
 * The content form's values: the description as plain text, empty things as "" / [] / null.
 * No entry yet (a session whose Strapi link is missing) is an empty form, not an error: the
 * first save creates the entry.
 */
export function toSessionContentDto(
  detail: CmsSessionDetail | null,
): SessionContentDto {
  return {
    description: detail ? blocksToText(detail.description) : "",
    prerequisites: detail?.prerequisites ?? null,
    resources: (detail?.resources ?? []).map((item) => ({
      label: item.label,
      url: item.url ?? "",
    })),
    coverImage: detail?.coverImage ? toMediaDto(detail.coverImage) : null,
  };
}

/** One image: the fields one by one, so a new field is never sent by accident. */
function toMediaDto(media: CmsMedia): CmsMedia {
  return {
    id: media.id,
    url: media.url,
    alt: media.alt,
    width: media.width,
    height: media.height,
  };
}

/** The cover alone, for the cover route. */
export function toSessionCoverDto(media: CmsMedia | null): SessionCoverDto {
  return { coverImage: media ? toMediaDto(media) : null };
}

/**
 * A session row → what the API answers: the columns one by one (so a new column is never sent
 * by accident), times as UTC ISO strings, and no Strapi id.
 */
export function toSessionDto(session: SessionWithSpeakers): SessionDto {
  return {
    id: session.id,
    eventId: session.eventId,
    hallId: session.hallId,
    hallName: session.hallName,
    title: session.title,
    type: session.type,
    mode: session.mode,
    status: session.status,
    onlineUrl: session.onlineUrl,
    startAt: session.startAt?.toISOString() ?? null,
    endAt: session.endAt?.toISOString() ?? null,
    requiresRegistration: session.requiresRegistration,
    price: session.price,
    speakers: session.speakers.map((speaker) => ({
      speakerId: speaker.speakerId,
      name: speaker.name,
      role: speaker.role,
      displayOrder: speaker.displayOrder,
    })),
  };
}

/**
 * The written part of a session for the public: the description as plain text, resources that
 * have an https link, and the cover without its Strapi file id. No entry yet (a session whose
 * Strapi link is missing) is empty content, not an error.
 */
export function toPublicSessionContentDto(
  detail: CmsSessionDetail | null,
): PublicSessionContentDto {
  return {
    description: detail ? blocksToText(detail.description) : "",
    prerequisites: detail?.prerequisites || null,
    resources: (detail?.resources ?? []).flatMap((item) =>
      // The organizer's form only accepts https links; a link edited in Strapi by hand is checked
      // again here, because the page shows it as a clickable link.
      item.url?.startsWith("https://")
        ? [{ label: item.label, url: item.url }]
        : [],
    ),
    coverImage: detail?.coverImage ? toPublicMediaDto(detail.coverImage) : null,
  };
}

/**
 * A session's public page: the facts from Postgres, the written content from the CMS (null =
 * the CMS did not answer, so the facts still show). The columns one by one, so a new column
 * (the join link!) is never made public by accident.
 */
export function toPublicSessionDetailDto(
  row: PublicSessionRow,
  content: PublicSessionContentDto | null,
): PublicSessionDetailDto {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    mode: row.mode,
    startAt: row.startAt?.toISOString() ?? null,
    endAt: row.endAt?.toISOString() ?? null,
    hallName: row.hallName,
    hallCapacity: row.hallCapacity,
    // Only a session that needs booking in a hall has a seat count; never below zero.
    seatsLeft:
      row.requiresRegistration && row.hallCapacity !== null
        ? Math.max(0, row.hallCapacity - row.booked)
        : null,
    venue: row.venue,
    price: row.price,
    requiresRegistration: row.requiresRegistration,
    speakers: row.speakers.map((speaker) => ({
      id: speaker.id,
      slug: speaker.slug,
      name: `${speaker.firstName} ${speaker.lastName}`,
      role: speaker.role,
    })),
    event: row.event,
    content,
  };
}
