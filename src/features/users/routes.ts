/** Page paths of the users feature, so a route is renamed in one place (like AUTH_ROUTES). */
export const USER_ROUTES = {
  /** The admin's list of users. */
  list: "/admin/users",
} as const;

/** The profile page of one user. `id` = users.id. */
export function adminUserHref(id: string): string {
  return `${USER_ROUTES.list}/${id}`;
}
