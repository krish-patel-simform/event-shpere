/** Page paths of the registrations feature, so a route is renamed in one place. */
export const REGISTRATION_ROUTES = {
  /** The signed-in attendee's tickets: every event they registered for (route 4). */
  myTickets: "/my-tickets",
  /**
   * The public events list and one event's page. They belong to the events feature
   * (EVENT_ROUTES.browse, publicEventHref), which imports this feature, so they are repeated
   * here; a test in the events feature checks they are the same.
   */
  browseEvents: "/events",
} as const;

/** One event's public page, by its link: /events/[slug]. */
export function publicEventPath(slug: string): string {
  return `${REGISTRATION_ROUTES.browseEvents}/${slug}`;
}
