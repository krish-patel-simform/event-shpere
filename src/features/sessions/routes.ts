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
