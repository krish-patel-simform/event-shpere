import { eventSessionNewHref, eventSessionsHref } from "../events";

// The "add a session" page is the events feature's too (its publish checklist links to it), so it
// is defined once there.
export { eventSessionNewHref };

/** Page paths of the sessions feature, so a route is renamed in one place (like USER_ROUTES). */
export const SESSION_ROUTES = {
  /** The speaker's own sessions (Speaking → My sessions). */
  list: "/speaker/sessions",
  /** The "Submit a session" form. `new` is matched before the [sessionId] segment. */
  create: "/speaker/sessions/new",
} as const;

/** The page of one session. `id` = sessions.id. */
export function sessionHref(id: string): string {
  return `${SESSION_ROUTES.list}/${id}`;
}

//* The organizer's pages: the sessions of one event, under /organizer/events/[eventId]/sessions

/**
 * The steps of the session form, in order. The URL holds the current one (`?step=content`), so a
 * refresh or the back button keeps the place.
 */
export const SESSION_STEPS = [
  "details",
  "speakers",
  "content",
  "cover",
] as const;
export type SessionStep = (typeof SESSION_STEPS)[number];

/** The step named by a `?step=` value; anything else (or nothing) is the first step. */
export function parseSessionStep(
  value: string | string[] | undefined,
): SessionStep {
  return SESSION_STEPS.find((step) => step === value) ?? "details";
}

/** The form that edits one session, on a step. `sessionId` = sessions.id. */
export function eventSessionEditHref(
  eventId: string,
  sessionId: string,
  step: SessionStep = "details",
): string {
  const path = `${eventSessionsHref(eventId)}/${sessionId}/edit`;
  return step === "details" ? path : `${path}?step=${step}`;
}
