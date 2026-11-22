import type { QueryClient } from "@tanstack/react-query";
import type {
  ListEventAttendeesParams,
  ListMyTicketsParams,
  ListSessionAttendeesParams,
} from "../api/registration-api.service";
import type { MyRegistrationDto } from "../schemas/registrations.schemas";

/** One place for the keys of the registrations feature. */
export const registrationQueryKeys = {
  all: ["registrations"] as const,
  /** Route 2: the signed-in user's standing in one event (registration + booked session ids). */
  mine: (eventId: string) => ["registrations", "mine", eventId] as const,
  /** Route 4: every page and filter of "My tickets". */
  tickets: ["registrations", "tickets"] as const,
  /** Route 4: one page of "My tickets" for one filter. */
  ticketList: (params: ListMyTicketsParams) =>
    ["registrations", "tickets", params] as const,
  /** Route 5: every page and filter of one event's Attendees tab (check-ins refresh it). */
  attendees: (eventId: string) =>
    ["registrations", "attendees", eventId] as const,
  /** Route 5: one page of one event's Attendees tab for one filter. */
  attendeeList: (eventId: string, params: ListEventAttendeesParams) =>
    ["registrations", "attendees", eventId, params] as const,
  /**
   * Route 5's whole-event counts for one day (or every day). Its own key, so a search, a filter,
   * a sort or a page does not reload them: only the day changes what they mean.
   */
  attendeeCounts: (eventId: string, date: string | undefined) =>
    ["registrations", "attendees", eventId, "counts", date ?? "all"] as const,
  /**
   * Route 10: one page of one session's attendees. Under the event's `attendees` key, so a
   * check-in (which can change the event's and the session's lists) refreshes both with one call.
   */
  sessionAttendeeList: (
    eventId: string,
    sessionId: string,
    params: ListSessionAttendeesParams,
  ) =>
    [
      "registrations",
      "attendees",
      eventId,
      "session",
      sessionId,
      params,
    ] as const,
  /** Route 10's whole-session counts: no filter changes them, so they have their own key. */
  sessionAttendeeCounts: (eventId: string, sessionId: string) =>
    [
      "registrations",
      "attendees",
      eventId,
      "session",
      sessionId,
      "counts",
    ] as const,
};

/**
 * After any change to the user's registrations or seats: every "My tickets" page is read again
 * the next time it is shown (status, seat counts). It is private and never cached by the CDN,
 * so a refetch always gets the current answer.
 */
export function invalidateMyTickets(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: registrationQueryKeys.tickets,
  });
}

/**
 * After a check-in at either door: the event's attendee list and counts AND every session list
 * of the event (their keys sit under the event's), so "Checked in" and "Pending" move.
 */
export function invalidateAttendees(
  queryClient: QueryClient,
  eventId: string,
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: registrationQueryKeys.attendees(eventId),
  });
}

/**
 * Every event's public page (the events feature's `eventQueryKeys.publicDetails`). Registering or
 * cancelling changes "seats left" on it. The events feature imports this one (it shows the
 * registration card), so this feature cannot import it back: the key is repeated here and a test
 * in the events feature checks the two are the same.
 */
export const PUBLIC_EVENT_DETAILS_KEY = ["events", "public", "detail"] as const;

/**
 * Every session's public page (the sessions feature's `sessionQueryKeys.publicDetails`). Booking
 * or cancelling a seat changes "seats left" on it. Repeated here for the same reason as above; a
 * test in the sessions feature checks the two are the same.
 */
export const PUBLIC_SESSION_DETAILS_KEY = ["sessions", "public"] as const;

/** The part of a cached public page this feature may touch: its id and seats left. */
type SeatsLeftCarrier = { id: string; seatsLeft: number | null };

function carriesSeatsLeft(value: unknown): value is SeatsLeftCarrier {
  if (typeof value !== "object" || value === null) return false;
  const { id, seatsLeft } = value as Record<string, unknown>;
  return (
    typeof id === "string" &&
    (seatsLeft === null || typeof seatsLeft === "number")
  );
}

/**
 * Moves "seats left" by one on every cached page under `rootKey` whose `id` is `id`. Used after
 * the user's own successful action, instead of fetching the page again: a refetch could be
 * answered by the CDN with a copy up to 90 s old (PUBLIC_CACHE_HEADERS), which would put the old
 * number back in front of the very person who just took the seat. The page is fetched fresh the
 * next time it is opened. No limit (null) stays null, and the count never goes below 0.
 */
function adjustSeatsLeft(
  queryClient: QueryClient,
  rootKey: readonly string[],
  id: string,
  delta: 1 | -1,
): void {
  queryClient.setQueriesData<unknown>(
    { queryKey: rootKey },
    (page: unknown) => {
      if (
        !carriesSeatsLeft(page) ||
        page.id !== id ||
        page.seatsLeft === null
      ) {
        return page;
      }
      return { ...page, seatsLeft: Math.max(0, page.seatsLeft + delta) };
    },
  );
}

/** After registering (-1) or cancelling (+1) for an event: its public page's seats left. */
export function adjustPublicSeatsLeft(
  queryClient: QueryClient,
  eventId: string,
  delta: 1 | -1,
): void {
  adjustSeatsLeft(queryClient, PUBLIC_EVENT_DETAILS_KEY, eventId, delta);
}

/** After booking (-1) or cancelling (+1) a seat: the session's public page's seats left. */
export function adjustPublicSessionSeatsLeft(
  queryClient: QueryClient,
  sessionId: string,
  delta: 1 | -1,
): void {
  adjustSeatsLeft(queryClient, PUBLIC_SESSION_DETAILS_KEY, sessionId, delta);
}

/**
 * Adds (booked) or removes (cancelled) one session in the user's booked sessions of an event, so
 * the session page and the event page ("3 sessions booked") show it without a second request.
 * When the standing is not cached yet, it is read again instead.
 */
export function setSessionBooked(
  queryClient: QueryClient,
  eventId: string,
  sessionId: string,
  booked: boolean,
): Promise<void> | void {
  const key = registrationQueryKeys.mine(eventId);
  const standing = queryClient.getQueryData<MyRegistrationDto>(key);
  if (!standing) {
    return queryClient.invalidateQueries({ queryKey: key });
  }
  const others = standing.bookedSessionIds.filter((id) => id !== sessionId);
  queryClient.setQueryData<MyRegistrationDto>(key, {
    ...standing,
    bookedSessionIds: booked ? [...others, sessionId] : others,
  });
}

/**
 * When the server said the page is not what it thought (a 409: full, closed, already registered):
 * read the standing and the seats left again, the exact numbers matter more than speed here.
 */
export function invalidateEventRegistration(
  queryClient: QueryClient,
  eventId: string,
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: registrationQueryKeys.mine(eventId),
    }),
    queryClient.invalidateQueries({ queryKey: PUBLIC_EVENT_DETAILS_KEY }),
    invalidateMyTickets(queryClient),
  ]).then(() => undefined);
}

/** The same after a refused booking: the standing and the sessions' seats left, read again. */
export function invalidateSessionBooking(
  queryClient: QueryClient,
  eventId: string,
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: registrationQueryKeys.mine(eventId),
    }),
    queryClient.invalidateQueries({ queryKey: PUBLIC_SESSION_DETAILS_KEY }),
    invalidateMyTickets(queryClient),
  ]).then(() => undefined);
}
