import {
  FEW_SEATS_LEFT,
  formatEventDates,
  formatEventTimes,
  formatTicketPrice,
  plural,
  PUBLIC_SESSION_TYPE_LABELS,
} from "../../events";
import type {
  SpeakerSessionDto,
  SpeakerSessionGroupDto,
  SpeakerSessionTimeline,
} from "../schemas/speaker-sessions.schemas";

/** The three sections of the speaker's Sessions card, in the order the page shows them. */
export const SPEAKER_SESSION_SECTIONS: readonly {
  timeline: SpeakerSessionTimeline;
  /** The section's anchor (#now) and heading. */
  title: string;
  /** What the jump link says. */
  link: string;
  hint: string;
  empty: string;
}[] = [
  {
    timeline: "now",
    title: "Happening now",
    link: "Now",
    hint: "Sessions on right now.",
    empty: "No sessions on right now.",
  },
  {
    timeline: "upcoming",
    title: "Upcoming",
    link: "Upcoming",
    hint: "Soonest event first.",
    empty: "No upcoming sessions yet.",
  },
  {
    timeline: "past",
    title: "Also spoken at",
    link: "Past",
    hint: "Past events, most recent first.",
    empty: "No past sessions yet.",
  },
];

/** The text and colour of a status badge (the tones of the Badge component). */
export type StatusBadge = {
  text: string;
  tone: "success" | "warning" | "brand" | "neutral";
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The badge on an event's header: "Live now" in the now section, and how far away it is in the
 * upcoming one ("In 3 days", amber when it is within a week). Past events have none.
 */
export function eventBadge(
  timeline: SpeakerSessionTimeline,
  eventStartAt: string,
  now: Date,
): StatusBadge | null {
  if (timeline === "now") return { text: "Live now", tone: "success" };
  if (timeline === "past") return null;

  const ms = Date.parse(eventStartAt) - now.getTime();
  // A multi-day event that has started: the speaker's session is still to come.
  if (ms <= 0) return { text: "Event under way", tone: "brand" };
  const days = Math.floor(ms / DAY_MS);
  if (days < 1) return { text: "In under a day", tone: "warning" };
  if (days < 14) {
    return {
      text: `In ${plural(days, "day")}`,
      tone: days <= 7 ? "warning" : "brand",
    };
  }
  if (days < 60) {
    return {
      text: `In ${plural(Math.floor(days / 7), "week")}`,
      tone: "brand",
    };
  }
  return {
    text: `In ${plural(Math.floor(days / 30), "month")}`,
    tone: "brand",
  };
}

/**
 * The badge on a session row: "Live now" in the now section; seats left in the upcoming one when
 * the session needs a booking ("Full" at 0, amber when few are left). Nothing otherwise.
 */
export function sessionBadge(
  timeline: SpeakerSessionTimeline,
  session: Pick<SpeakerSessionDto, "seatsLeft">,
): StatusBadge | null {
  if (timeline === "now") return { text: "Live now", tone: "success" };
  if (timeline === "past" || session.seatsLeft === null) return null;
  if (session.seatsLeft === 0) return { text: "Full", tone: "neutral" };
  return {
    text: `${plural(session.seatsLeft, "seat")} left`,
    tone: session.seatsLeft <= FEW_SEATS_LEFT ? "warning" : "success",
  };
}

/** "Fri 14 – Sun 16 Nov 2026 · Tech Park Auditorium, Pune · Free". */
export function eventMeta(event: SpeakerSessionGroupDto["event"]): string {
  return [
    formatEventDates(event.startAt, event.endAt, event.timezone, {
      weekday: true,
    }),
    event.venue ? `${event.venue.name}, ${event.venue.city}` : "Online",
    formatTicketPrice(event.ticketPrice),
  ].join(" · ");
}

/** "Fri 14 Nov 2026" and "11:00 – 11:45 IST", in the event's zone. */
export function sessionWhen(
  session: Pick<SpeakerSessionDto, "startAt" | "endAt">,
  timezone: string,
): { date: string; time: string } {
  return {
    date: formatEventDates(session.startAt, session.endAt, timezone, {
      weekday: true,
    }),
    time: formatEventTimes(session.startAt, session.endAt, timezone),
  };
}

const MODE_LABELS: Record<SpeakerSessionDto["mode"], string | null> = {
  in_person: null,
  online: "Online",
  hybrid: "Hybrid",
};

/** "Hall A · Talk", "Online room · Workshop · Online", "Main Hall · Panel · ₹500 extra". */
export function sessionDetails(session: SpeakerSessionDto): string {
  return [
    session.hallName ?? "Online",
    PUBLIC_SESSION_TYPE_LABELS[session.type],
    MODE_LABELS[session.mode],
    session.price > 0 ? `${formatTicketPrice(session.price)} extra` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** "3 sessions · 2 events", from the totals the API sends. */
export function countLabel(sessions: number, events: number): string {
  return `${plural(sessions, "session")} · ${plural(events, "event")}`;
}
