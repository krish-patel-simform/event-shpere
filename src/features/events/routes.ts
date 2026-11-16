/**
 * Page paths of the events feature, so a route is renamed in one place (like VENUE_ROUTES).
 * The organizer's pages live under /organizer: /my-events is the attendee's "events I registered
 * for".
 */
export const EVENT_ROUTES = {
  /** The organizer's list of their events (drafts, published, completed, cancelled). */
  list: "/organizer/events",
  /** The form that creates an event (saved as a draft). */
  new: "/organizer/events/new",
  /** Discover: the public events page everyone can browse. */
  browse: "/events",
} as const;

/** The organizer's overview of one event. `id` = events.id. */
export function eventHref(id: string): string {
  return `${EVENT_ROUTES.list}/${id}`;
}

/** The organizer's sessions of one event (its second tab). `id` = events.id. */
export function eventSessionsHref(id: string): string {
  return `${eventHref(id)}/sessions`;
}

/** The organizer's schedule board of one event (its third tab). `id` = events.id. */
export function eventScheduleHref(id: string): string {
  return `${eventHref(id)}/schedule`;
}

/** The speakers assigned to one event (its fourth tab). `id` = events.id. */
export function eventSpeakersHref(id: string): string {
  return `${eventHref(id)}/speakers`;
}

/** The halls of one event's venue (its fifth tab). `id` = events.id. */
export function eventHallsHref(id: string): string {
  return `${eventHref(id)}/halls`;
}

/** The people registered for one event (its last tab). `id` = events.id. */
export function eventAttendeesHref(id: string): string {
  return `${eventHref(id)}/attendees`;
}

/** The form that adds a session to an event. `id` = events.id. */
export function eventSessionNewHref(id: string): string {
  return `${eventSessionsHref(id)}/new`;
}

/**
 * The steps of the event form, in order. The URL holds the current one (`?step=content`), so a
 * refresh or the back button keeps the place.
 */
export const EVENT_STEPS = ["details", "content", "media"] as const;
export type EventStep = (typeof EVENT_STEPS)[number];

/** The step named by a `?step=` value; anything else (or nothing) is the first step. */
export function parseEventStep(
  value: string | string[] | undefined,
): EventStep {
  return EVENT_STEPS.find((step) => step === value) ?? "details";
}

/** The form that edits one event, on a step. `id` = events.id. */
export function eventEditHref(id: string, step: EventStep = "details"): string {
  const path = `${eventHref(id)}/edit`;
  return step === "details" ? path : `${path}?step=${step}`;
}

/** The public page of one event. `slug` = events.slug. */
export function publicEventHref(slug: string): string {
  return `${EVENT_ROUTES.browse}/${slug}`;
}

/**
 * The public page of one session of an event. `slug` = events.slug, `sessionId` = sessions.id.
 * It is defined here, not in the sessions feature, because the event's programme links to it and
 * the sessions feature already imports from events.
 */
export function publicSessionHref(slug: string, sessionId: string): string {
  return `${publicEventHref(slug)}/sessions/${sessionId}`;
}
