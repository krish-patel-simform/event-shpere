import type { QueryClient } from "@tanstack/react-query";
import type { ListMyEventsParams } from "../api/event-api.service";

/** One place for the keys: a change to an event refreshes its overview, every list and the tab counts. */
export const eventQueryKeys = {
  all: ["events"] as const,
  list: (params: ListMyEventsParams) => ["events", "list", params] as const,
  lists: ["events", "list"] as const,
  counts: ["events", "counts"] as const,
  overview: (eventId: string) => ["events", "overview", eventId] as const,
  /** The event page's text and images (Strapi): the content and media steps. */
  content: (eventId: string) => ["events", "content", eventId] as const,
};

/**
 * After an event was created or changed: the lists and the tab counts show it (title, dates,
 * status) and the overview shows its details, so all three are reloaded the next time they are
 * used. The open page shows the skeleton while they load, never the old rows.
 */
export function invalidateEvent(queryClient: QueryClient, eventId?: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: eventQueryKeys.lists }),
    queryClient.invalidateQueries({ queryKey: eventQueryKeys.counts }),
    eventId
      ? queryClient.invalidateQueries({
          queryKey: eventQueryKeys.overview(eventId),
        })
      : undefined,
  ]);
}

/**
 * After the event page's text or an image changed: the content and media steps show it and the
 * overview's publish checklist (description written, banner added) depends on it. The lists and
 * the tab counts do not show any of it, so they are left alone.
 */
export function invalidateEventContent(
  queryClient: QueryClient,
  eventId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: eventQueryKeys.content(eventId),
    }),
    queryClient.invalidateQueries({
      queryKey: eventQueryKeys.overview(eventId),
    }),
  ]);
}
