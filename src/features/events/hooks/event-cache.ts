import type { QueryClient } from "@tanstack/react-query";
import type {
  ListMyEventsParams,
  ListPublicEventsParams,
} from "../api/event-api.service";
import type { EventContentDto } from "../schemas/event-content.schemas";
import type { EventOverviewData } from "../types/event-manage.types";
import { contentFlags } from "../utils/event-content-flags";

/** One place for the keys: a change to an event refreshes its overview, every list and the tab counts. */
export const eventQueryKeys = {
  all: ["events"] as const,
  list: (params: ListMyEventsParams) => ["events", "list", params] as const,
  lists: ["events", "list"] as const,
  counts: ["events", "counts"] as const,
  overview: (eventId: string) => ["events", "overview", eventId] as const,
  /** The event page's text and images (Strapi): the content and media steps. */
  content: (eventId: string) => ["events", "content", eventId] as const,
  /** What anyone can browse: a page of published events, and one event's public page. */
  publicList: (params: ListPublicEventsParams) =>
    ["events", "public", "list", params] as const,
  publicDetail: (slug: string) => ["events", "public", "detail", slug] as const,
  /**
   * Every event's public page. Its programme is the event's scheduled sessions, so a change to a
   * session reloads them all (the sessions feature knows the event's id, not its public link).
   */
  publicDetails: ["events", "public", "detail"] as const,
};

/**
 * The root of every query of the sessions feature (its `sessionQueryKeys.all`). Cancelling an event
 * cancels all its sessions on the server, so every sessions list and detail must reload; the events
 * feature cannot import the sessions feature (sessions already imports events), so the root key
 * is repeated here and a test in the sessions feature checks the two are the same.
 */
export const SESSIONS_QUERY_ROOT = ["sessions"] as const;

/**
 * Keys that name a running mutation, so a screen can ask "is anything of this kind running?"
 * (useIsMutating) without the components passing state to each other.
 */
export const eventMutationKeys = {
  /** Uploading or removing the cover or a gallery image of one event. */
  media: (eventId: string) => ["events", "media", eventId] as const,
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
 * The overview only holds two flags about the page content (for the stepper ticks and the publish
 * checklist), so a change to the content never needs the whole overview again: the flags are
 * worked out from the content. No overview cached: nothing to update, and it is fetched fresh when
 * it is next needed.
 */
function syncOverviewFlags(
  queryClient: QueryClient,
  eventId: string,
  content: EventContentDto,
) {
  queryClient.setQueryData<EventOverviewData>(
    eventQueryKeys.overview(eventId),
    (overview) => overview && { ...overview, content: contentFlags(content) },
  );
}

/**
 * After the event page's text or an image was saved: show what the server answered at once, then
 * read the content again, so what is on screen is what is stored (the content is the thing that
 * changed, and it is read, never guessed). The overview is NOT read again: its two flags follow
 * from the content. `next` receives the content cached right now (undefined when none is), so
 * two saves that overlap each keep the other's part. A read still on its way is cancelled first,
 * or it would land after this and bring the old content back.
 *
 * Nothing cached to build on (the step was never loaded here) asks for both again.
 */
async function writeEventContent(
  queryClient: QueryClient,
  eventId: string,
  next: (current: EventContentDto | undefined) => EventContentDto | undefined,
) {
  const contentKey = eventQueryKeys.content(eventId);
  await Promise.all([
    queryClient.cancelQueries({ queryKey: contentKey }),
    queryClient.cancelQueries({ queryKey: eventQueryKeys.overview(eventId) }),
  ]);

  const answered = next(queryClient.getQueryData<EventContentDto>(contentKey));
  if (!answered) return invalidateEventContent(queryClient, eventId);

  // At once: the step shows the change without waiting for the read below.
  queryClient.setQueryData(contentKey, answered);
  syncOverviewFlags(queryClient, eventId, answered);

  // Then what is stored. If the read fails, the answer above stays on screen.
  await queryClient.invalidateQueries({ queryKey: contentKey });
  const stored = queryClient.getQueryData<EventContentDto>(contentKey);
  if (stored) syncOverviewFlags(queryClient, eventId, stored);
}

/** After the text was saved: the answer is the whole content. */
export function applyEventContent(
  queryClient: QueryClient,
  eventId: string,
  content: EventContentDto,
) {
  return writeEventContent(queryClient, eventId, () => content);
}

/**
 * After the cover or the gallery changed: the answer holds only that part, so it is merged into
 * the content that is cached, and the content is then read again for the rest.
 */
export function patchEventMedia(
  queryClient: QueryClient,
  eventId: string,
  media: Partial<Pick<EventContentDto, "coverImage" | "gallery">>,
) {
  return writeEventContent(
    queryClient,
    eventId,
    (current) => current && { ...current, ...media },
  );
}

/**
 * Asks again for the event page's text and images and the overview's checklist. Only the way out
 * when there is nothing cached to update (see writeEventContent): a normal save reads the content
 * alone, and works the overview's two flags out from it.
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
