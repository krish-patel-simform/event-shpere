import {
  eventEditHref,
  eventSessionNewHref,
  eventSessionsHref,
} from "../routes";
import { plural } from "./event-display";

/** What decides whether an event can be published. */
export type PublishChecklistInput = {
  /** The event, so each missing item can link to the page that fixes it. */
  eventId: string;
  /** A venue is chosen. */
  hasVenue: boolean;
  hallCount: number;
  /** What the event page holds; null = the CMS did not answer, so it could not be checked. */
  content: { hasDescription: boolean; hasBanner: boolean } | null;
  sessions: { total: number; scheduled: number; cancelled: number };
};

export type ChecklistKey = "details" | "content" | "halls" | "sessions";

export type ChecklistItem = {
  key: ChecklistKey;
  title: string;
  ok: boolean;
  /** What is done, or what is still missing. */
  description: string;
  /** Where to fix what is missing; null when it is done, or when the organizer cannot fix it. */
  action: { label: string; href: string } | null;
};

export type PublishChecklist = {
  items: ChecklistItem[];
  /** "content" or "2 unscheduled sessions", one per item that is not done. */
  missing: string[];
  /** "Missing: content, 2 unscheduled sessions", or null when nothing is missing. */
  summary: string | null;
  canPublish: boolean;
};

/**
 * The rules for publishing an event, as a pure function so the screen and (later) the server
 * use the same ones. The server must still recompute them: a client's checklist is never trusted.
 */
export function getPublishChecklist(
  input: PublishChecklistInput,
): PublishChecklist {
  const { eventId, hasVenue, hallCount, content } = input;
  const { total, scheduled, cancelled } = input.sessions;
  // Cancelled sessions are not waiting for a slot on the board.
  const unscheduled = Math.max(total - scheduled - cancelled, 0);

  const items: ChecklistItem[] = [
    {
      key: "details",
      title: "Event details",
      ok: hasVenue,
      description: hasVenue
        ? "Dates, venue, capacity and ticket price are set."
        : "Choose a venue for the event.",
      action: hasVenue
        ? null
        : { label: "Choose venue", href: eventEditHref(eventId) },
    },
    {
      key: "content",
      title: "Page content",
      // Unknown is not ok: an event is never published on a guess.
      ok: content?.hasDescription ?? false,
      description:
        content === null
          ? "The page content could not be checked right now. Try again in a moment."
          : content.hasDescription
            ? "The description is written."
            : `The description is missing.${content.hasBanner ? "" : " A banner placeholder will be used."}`,
      // Nothing to fix when the CMS just did not answer: the check is tried again on its own.
      action:
        content === null || content.hasDescription
          ? null
          : {
              label: "Write content",
              href: eventEditHref(eventId, "content"),
            },
    },
    {
      key: "halls",
      title: "Halls",
      ok: hallCount > 0,
      description:
        hallCount > 0
          ? `${plural(hallCount, "hall")} available at the venue.`
          : "The venue has no halls yet. An administrator adds them.",
      // Only an administrator can add halls.
      action: null,
    },
    {
      key: "sessions",
      title: "Sessions on the schedule",
      ok: total > 0 && unscheduled === 0,
      description:
        total === 0
          ? "Add at least one session."
          : unscheduled > 0
            ? `${plural(unscheduled, "session")} ${unscheduled === 1 ? "is" : "are"} not scheduled yet.`
            : "Every session is on the schedule.",
      action:
        total === 0
          ? { label: "Add session", href: eventSessionNewHref(eventId) }
          : unscheduled > 0
            ? { label: "Review sessions", href: eventSessionsHref(eventId) }
            : null,
    },
  ];

  const missing = items
    .filter((item) => !item.ok)
    .map((item) => {
      switch (item.key) {
        case "details":
          return "event details";
        case "content":
          return "content";
        case "halls":
          return "halls";
        case "sessions":
          return total === 0
            ? "sessions"
            : `${unscheduled} unscheduled ${unscheduled === 1 ? "session" : "sessions"}`;
      }
    });

  return {
    items,
    missing,
    summary: missing.length > 0 ? `Missing: ${missing.join(", ")}` : null,
    canPublish: missing.length === 0,
  };
}
