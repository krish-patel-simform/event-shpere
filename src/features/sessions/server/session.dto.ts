import "server-only";
import { blocksToText, type CmsMedia, type CmsSessionDetail } from "../../cms";
import type {
  SessionContentDto,
  SessionCoverDto,
} from "../schemas/session-content.schemas";
import type { SessionDto } from "../schemas/sessions.schemas";
import type { SessionWithSpeakers } from "./session.repository";

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
