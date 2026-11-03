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
