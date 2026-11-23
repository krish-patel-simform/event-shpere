// Calls to the registration API, built on the shared axios instance. React Query hooks (../hooks)
// wrap these; components use the hooks. Every answer is parsed with the same Zod schema the
// server responds with. No request sends a user id: "me" is always the login (httpOnly cookie).
import {
  apiRequest,
  apiRequestPage,
  type PageMeta,
} from "../../../core/api-client/base-api.service";
import {
  attendeeListMetaSchema,
  attendeeListResponseSchema,
  sessionAttendeeListMetaSchema,
  sessionAttendeeListResponseSchema,
  type AttendeeDto,
  type AttendeeListMeta,
  type AttendeeListQuery,
  type SessionAttendeeDto,
  type SessionAttendeeListMeta,
} from "../schemas/attendees.schemas";
import {
  checkInBodySchema,
  checkInResponseSchema,
  eventCheckInBodySchema,
  sessionCheckInResponseSchema,
  type CheckInBody,
  type CheckInDto,
  type EventCheckInBody,
  type SessionCheckInDto,
} from "../schemas/check-ins.schemas";
import {
  myRegistrationResponseSchema,
  myTicketListResponseSchema,
  registrationResponseSchema,
  sessionBookingResponseSchema,
  type MyRegistrationDto,
  type MyRegistrationListQuery,
  type MyTicketDto,
  type RegistrationDto,
  type SessionBookingDto,
} from "../schemas/registrations.schemas";

/**
 * What the Attendees tab asks for (route 5). `search` and `date` may be empty: they are then
 * left out of the URL.
 */
export type ListEventAttendeesParams = Omit<
  AttendeeListQuery,
  "search" | "date"
> & {
  search?: string;
  /** "2026-12-03": one event day; undefined = any day. */
  date?: string;
};

/** What a session's attendee list asks for (route 10): route 5's filters without a day. */
export type ListSessionAttendeesParams = Omit<ListEventAttendeesParams, "date">;

/** What "My tickets" asks for: a page, a status filter and when the events end. */
export type ListMyTicketsParams = Omit<MyRegistrationListQuery, "page"> & {
  page?: number;
};

const registrationsUrl = (eventId: string) =>
  `/events/${eventId}/registrations`;
const sessionBookingsUrl = (eventId: string, sessionId: string) =>
  `/events/${eventId}/sessions/${sessionId}/registrations`;

export const registrationApiService = {
  /**
   * Route 1: registers the signed-in user for the event (no body). A cancelled registration is
   * revived with a new ticket code. Every refusal is a 409 with a named code (EVENT_FULL...).
   */
  register(eventId: string): Promise<RegistrationDto> {
    return apiRequest(
      { method: "POST", url: registrationsUrl(eventId) },
      registrationResponseSchema,
    );
  },

  /**
   * Route 2: the signed-in user's standing in one event. `registration` is null when they never
   * registered (a normal answer, not an error).
   */
  getMine(eventId: string): Promise<MyRegistrationDto> {
    return apiRequest(
      { method: "GET", url: `${registrationsUrl(eventId)}/me` },
      myRegistrationResponseSchema,
    );
  },

  /**
   * Route 3: cancels the signed-in user's registration and all their session seats of this event.
   * Answers the same shape as route 2 (status "cancelled", no booked sessions).
   */
  cancel(eventId: string): Promise<MyRegistrationDto> {
    return apiRequest(
      { method: "DELETE", url: `${registrationsUrl(eventId)}/me` },
      myRegistrationResponseSchema,
    );
  },

  /**
   * Route 4: one page of the signed-in user's tickets ("My tickets"), by when the event ends
   * (`when`) and by the registration's status. Only what is set goes into the URL, so the
   * server's defaults apply to the rest.
   */
  listMyTickets({
    page = 1,
    pageSize,
    status,
    when,
  }: ListMyTicketsParams): Promise<{
    items: MyTicketDto[];
    meta: PageMeta;
  }> {
    return apiRequestPage(
      {
        method: "GET",
        url: "/me/registrations",
        params: { page, pageSize, status, when },
      },
      myTicketListResponseSchema,
    );
  },

  /**
   * Route 5: one page of who registered for an event (organizer: own event; admin: any), with
   * whole-event counts in `meta.counts`. Only what is set goes into the URL, so the server's
   * defaults apply to the rest (an empty search and "all days" are left out).
   */
  listEventAttendees(
    eventId: string,
    { search, date, ...params }: ListEventAttendeesParams,
  ): Promise<{ items: AttendeeDto[]; meta: AttendeeListMeta }> {
    return apiRequestPage(
      {
        method: "GET",
        url: `/events/${eventId}/attendees`,
        params: {
          ...params,
          ...(search ? { search } : {}),
          ...(date ? { date } : {}),
        },
      },
      attendeeListResponseSchema,
      attendeeListMetaSchema,
    );
  },

  /**
   * Route 10: one page of who holds a seat in one session (organizer: own event; admin: any),
   * with whole-session counts in `meta.counts`. Same filters as route 5, without a day (a session
   * happens once). An empty search is left out of the URL.
   */
  listSessionAttendees(
    eventId: string,
    sessionId: string,
    { search, ...params }: ListSessionAttendeesParams,
  ): Promise<{ items: SessionAttendeeDto[]; meta: SessionAttendeeListMeta }> {
    return apiRequestPage(
      {
        method: "GET",
        url: `/events/${eventId}/sessions/${sessionId}/attendees`,
        params: { ...params, ...(search ? { search } : {}) },
      },
      sessionAttendeeListResponseSchema,
      sessionAttendeeListMetaSchema,
    );
  },

  /**
   * Route 8: books a seat in one session for the signed-in user (no body). Needs a live event
   * registration; every refusal is a 409 with a named code (SESSION_FULL...).
   */
  bookSession(eventId: string, sessionId: string): Promise<SessionBookingDto> {
    return apiRequest(
      { method: "POST", url: sessionBookingsUrl(eventId, sessionId) },
      sessionBookingResponseSchema,
    );
  },

  /** Route 9: cancels the signed-in user's seat. Answers the booking with status "cancelled". */
  cancelSessionBooking(
    eventId: string,
    sessionId: string,
  ): Promise<SessionBookingDto> {
    return apiRequest(
      { method: "DELETE", url: `${sessionBookingsUrl(eventId, sessionId)}/me` },
      sessionBookingResponseSchema,
    );
  },

  /**
   * Route 6: checks a person in at the event door for ONE event day. The body is checked with the
   * server's own schema first (a code of 1–32 characters, a YYYY-MM-DD day), so a bad request
   * never leaves the browser.
   */
  checkInAtEvent(eventId: string, body: EventCheckInBody): Promise<CheckInDto> {
    return apiRequest(
      {
        method: "POST",
        url: `/events/${eventId}/check-ins`,
        data: eventCheckInBodySchema.parse(body),
      },
      checkInResponseSchema,
    );
  },

  /**
   * Route 11: checks a booked person in at one session. Only the code: the server works out the
   * event day from the session's start.
   */
  checkInAtSession(
    eventId: string,
    sessionId: string,
    body: CheckInBody,
  ): Promise<SessionCheckInDto> {
    return apiRequest(
      {
        method: "POST",
        url: `/events/${eventId}/sessions/${sessionId}/check-ins`,
        data: checkInBodySchema.parse(body),
      },
      sessionCheckInResponseSchema,
    );
  },
};
