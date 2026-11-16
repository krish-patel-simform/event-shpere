/** Page paths of the venues feature, so a route is renamed in one place (like ORGANIZER_ROUTES). */
export const VENUE_ROUTES = {
  /** The admin's list of venues. */
  list: "/admin/venues",
  /** The form that adds a venue with its halls. */
  new: "/admin/venues/new",
  /** Discover: the venues everyone can browse (active ones only). */
  browse: "/venues",
} as const;

/** Discover: the public page of one venue and its active halls. `id` = venues.id. */
export function venueHref(id: string): string {
  return `${VENUE_ROUTES.browse}/${id}`;
}

/** The page for one venue and its halls. `id` = venues.id. */
export function adminVenueHref(id: string): string {
  return `${VENUE_ROUTES.list}/${id}`;
}

/** The form that edits one venue's details. `id` = venues.id. */
export function adminVenueEditHref(id: string): string {
  return `${adminVenueHref(id)}/edit`;
}
