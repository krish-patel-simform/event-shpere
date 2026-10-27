/** Page paths of the organizer feature, so a route is renamed in one place (like AUTH_ROUTES). */
export const ORGANIZER_ROUTES = {
  /** The admin's list of organizers (waiting, approved, rejected). */
  list: "/admin/organizers",
} as const;

/** The page where the admin reviews one application. `id` = organizer_profiles.id. */
export function adminOrganizerHref(id: string): string {
  return `${ORGANIZER_ROUTES.list}/${id}`;
}
