import "server-only";
import type {
  SpeakerSessionDto,
  SpeakerSessionGroupDto,
} from "../schemas/speaker-sessions.schemas";
import type {
  SpeakerSessionGroupRow,
  SpeakerSessionRow,
} from "./speaker-session.repository";

function toSpeakerSessionDto(row: SpeakerSessionRow): SpeakerSessionDto {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    mode: row.mode,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    hallName: row.hallName,
    price: row.price,
    requiresRegistration: row.requiresRegistration,
    // Only a session that needs booking in a hall has a seat count; never below zero.
    seatsLeft:
      row.requiresRegistration && row.hallCapacity !== null
        ? Math.max(0, row.hallCapacity - row.booked)
        : null,
  };
}

/** Picks fields one by one, so no column added to a table later leaves by accident. */
export function toSpeakerSessionGroupDto(
  group: SpeakerSessionGroupRow,
): SpeakerSessionGroupDto {
  const { event } = group;
  return {
    event: {
      slug: event.slug,
      title: event.title,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      timezone: event.timezone,
      venue:
        event.venueName !== null && event.venueCity !== null
          ? { name: event.venueName, city: event.venueCity }
          : null,
      ticketPrice: event.ticketPrice,
    },
    sessions: group.sessions.map(toSpeakerSessionDto),
  };
}
