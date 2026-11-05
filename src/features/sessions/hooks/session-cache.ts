import type { QueryClient } from "@tanstack/react-query";
import { invalidateEvent } from "../../events";

/**
 * One place for the keys of the organizer's sessions. A session lives under its event, so every
 * key carries the event id: another event's sessions are never mixed in.
 */
export const sessionQueryKeys = {
  all: ["sessions"] as const,
  /** Every session of one event: the Sessions tab. */
  list: (eventId: string) => ["sessions", "list", eventId] as const,
  /** One session: the details and speakers steps. */
  detail: (eventId: string, sessionId: string) =>
    ["sessions", "detail", eventId, sessionId] as const,
  /** The session's text and cover (Strapi): the content and cover steps. */
  content: (eventId: string, sessionId: string) =>
    ["sessions", "content", eventId, sessionId] as const,
};

/**
 * Keys that name a running mutation, so a screen can ask "is anything of this kind running?"
 * (useIsMutating) without the components passing state to each other.
 */
export const sessionMutationKeys = {
  /** Uploading or removing the cover of one session. */
  media: (eventId: string, sessionId: string) =>
    ["sessions", "media", eventId, sessionId] as const,
};

/**
 * After a session was created, edited, moved, cancelled or got new speakers: the event's list
 * and (when it is known) that session's details show it, and so do the event's own pages: its
 * session counts and its publish checklist ("at least one session, none unscheduled") depend on
 * the sessions. All of them reload the next time they are used; an open page shows the skeleton
 * while they load, never the old rows.
 */
export function invalidateSession(
  queryClient: QueryClient,
  eventId: string,
  sessionId?: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: sessionQueryKeys.list(eventId) }),
    sessionId
      ? queryClient.invalidateQueries({
          queryKey: sessionQueryKeys.detail(eventId, sessionId),
        })
      : undefined,
    invalidateEvent(queryClient, eventId),
  ]);
}

/**
 * After a session's text or cover changed: only the content and cover steps show it. The list and
 * the event's pages read from Postgres, which did not change, so they are left alone.
 */
export function invalidateSessionContent(
  queryClient: QueryClient,
  eventId: string,
  sessionId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: sessionQueryKeys.content(eventId, sessionId),
  });
}
