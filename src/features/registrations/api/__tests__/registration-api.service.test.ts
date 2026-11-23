import {
  apiRequest,
  apiRequestPage,
} from "../../../../core/api-client/base-api.service";
import {
  attendeeListMetaSchema,
  attendeeListResponseSchema,
  sessionAttendeeListMetaSchema,
  sessionAttendeeListResponseSchema,
} from "../../schemas/attendees.schemas";
import {
  checkInResponseSchema,
  sessionCheckInResponseSchema,
} from "../../schemas/check-ins.schemas";
import {
  myRegistrationResponseSchema,
  myTicketListResponseSchema,
  registrationResponseSchema,
  sessionBookingResponseSchema,
} from "../../schemas/registrations.schemas";
import { registrationApiService } from "../registration-api.service";

jest.mock("../../../../core/api-client/base-api.service", () => ({
  apiRequest: jest.fn(),
  apiRequestPage: jest.fn(),
}));
const requestPage = jest.mocked(apiRequestPage);
// apiRequest has two overloads (with and without a schema); the mock answers like the first.
const request = jest.mocked(
  apiRequest as (...args: unknown[]) => Promise<unknown>,
);

const eventId = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const sessionId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";

beforeEach(() => jest.clearAllMocks());

describe("registrationApiService: event attendees", () => {
  it("listEventAttendees GETs the event's attendees with every filter, and parses rows and counts", () => {
    void registrationApiService.listEventAttendees(eventId, {
      page: 3,
      pageSize: 10,
      status: "registered",
      checkedIn: "no",
      sort: "name",
      search: "priya",
      date: "2026-12-04",
    });

    expect(requestPage).toHaveBeenCalledWith(
      {
        method: "GET",
        url: `/events/${eventId}/attendees`,
        params: {
          page: 3,
          pageSize: 10,
          status: "registered",
          checkedIn: "no",
          sort: "name",
          search: "priya",
          date: "2026-12-04",
        },
      },
      attendeeListResponseSchema,
      attendeeListMetaSchema,
    );
  });

  it("leaves an empty search and 'all days' out of the URL", () => {
    void registrationApiService.listEventAttendees(eventId, {
      page: 1,
      pageSize: 10,
      status: "all",
      checkedIn: "all",
      sort: "newest",
      search: "",
      date: undefined,
    });

    const [config] = requestPage.mock.calls[0] ?? [];
    expect(config?.params).toEqual({
      page: 1,
      pageSize: 10,
      status: "all",
      checkedIn: "all",
      sort: "newest",
    });
  });
});

describe("registrationApiService: session attendees", () => {
  it("listSessionAttendees GETs the session's attendees, parsing rows and counts, without an empty search", () => {
    void registrationApiService.listSessionAttendees(eventId, sessionId, {
      page: 2,
      pageSize: 10,
      status: "all",
      checkedIn: "yes",
      sort: "checkedIn",
      search: "",
    });

    expect(requestPage).toHaveBeenCalledWith(
      {
        method: "GET",
        url: `/events/${eventId}/sessions/${sessionId}/attendees`,
        params: {
          page: 2,
          pageSize: 10,
          status: "all",
          checkedIn: "yes",
          sort: "checkedIn",
        },
      },
      sessionAttendeeListResponseSchema,
      sessionAttendeeListMetaSchema,
    );
  });
});

describe("registrationApiService: check-ins", () => {
  it("checkInAtEvent POSTs the code (trimmed, upper-cased) and the day, and parses the check-in", () => {
    void registrationApiService.checkInAtEvent(eventId, {
      ticketCode: " esevt7k3q9p ",
      attendanceDate: "2026-12-04",
    });

    expect(request).toHaveBeenCalledWith(
      {
        method: "POST",
        url: `/events/${eventId}/check-ins`,
        data: { ticketCode: "ESEVT7K3Q9P", attendanceDate: "2026-12-04" },
      },
      checkInResponseSchema,
    );
  });

  it("checkInAtSession POSTs ONLY the code to the session's route", () => {
    void registrationApiService.checkInAtSession(eventId, sessionId, {
      ticketCode: "ESEVT7K3Q9P",
    });

    expect(request).toHaveBeenCalledWith(
      {
        method: "POST",
        url: `/events/${eventId}/sessions/${sessionId}/check-ins`,
        data: { ticketCode: "ESEVT7K3Q9P" },
      },
      sessionCheckInResponseSchema,
    );
  });

  it("sends nothing for a body the server would refuse (no code, a day that is not a date)", () => {
    expect(() =>
      registrationApiService.checkInAtEvent(eventId, {
        ticketCode: "  ",
        attendanceDate: "2026-12-04",
      }),
    ).toThrow();
    expect(() =>
      registrationApiService.checkInAtEvent(eventId, {
        ticketCode: "ESEVT7K3Q9P",
        attendanceDate: "4 Dec",
      }),
    ).toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});

describe("registrationApiService: my tickets", () => {
  it("listMyTickets GETs /me/registrations with the page and filters, and parses the list", () => {
    void registrationApiService.listMyTickets({
      page: 2,
      pageSize: 10,
      status: "cancelled",
      when: "past",
    });

    expect(requestPage).toHaveBeenCalledWith(
      {
        method: "GET",
        url: "/me/registrations",
        params: { page: 2, pageSize: 10, status: "cancelled", when: "past" },
      },
      myTicketListResponseSchema,
    );
  });

  it("starts at the first page", () => {
    void registrationApiService.listMyTickets({
      pageSize: 10,
      status: "all",
      when: "upcoming",
    });

    expect(requestPage).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ page: 1 }),
      }),
      myTicketListResponseSchema,
    );
  });
});

describe("registrationApiService: session seats", () => {
  it("bookSession POSTs to the session's registrations with NO body, and parses the booking", () => {
    void registrationApiService.bookSession(eventId, sessionId);

    expect(request).toHaveBeenCalledWith(
      {
        method: "POST",
        url: `/events/${eventId}/sessions/${sessionId}/registrations`,
      },
      sessionBookingResponseSchema,
    );
    const [config] = request.mock.calls[0] ?? [];
    expect(config).not.toHaveProperty("data");
  });

  it("cancelSessionBooking DELETEs /me and parses the cancelled booking", () => {
    void registrationApiService.cancelSessionBooking(eventId, sessionId);

    expect(request).toHaveBeenCalledWith(
      {
        method: "DELETE",
        url: `/events/${eventId}/sessions/${sessionId}/registrations/me`,
      },
      sessionBookingResponseSchema,
    );
  });
});

describe("registrationApiService", () => {
  it("register POSTs to the event's registrations with NO body, and parses the ticket", () => {
    void registrationApiService.register(eventId);

    expect(request).toHaveBeenCalledWith(
      { method: "POST", url: `/events/${eventId}/registrations` },
      registrationResponseSchema,
    );
    // Who registers comes from the login cookie, never from the request.
    const [config] = request.mock.calls[0] ?? [];
    expect(config).not.toHaveProperty("data");
  });

  it("getMine GETs the standing of the signed-in user (/me), parsed", () => {
    void registrationApiService.getMine(eventId);

    expect(request).toHaveBeenCalledWith(
      { method: "GET", url: `/events/${eventId}/registrations/me` },
      myRegistrationResponseSchema,
    );
  });

  it("cancel DELETEs /me and parses the new standing", () => {
    void registrationApiService.cancel(eventId);

    expect(request).toHaveBeenCalledWith(
      { method: "DELETE", url: `/events/${eventId}/registrations/me` },
      myRegistrationResponseSchema,
    );
  });

  it("passes the parsed answer through", async () => {
    const standing = { registration: null, bookedSessionIds: [] };
    request.mockResolvedValue(standing);

    await expect(registrationApiService.getMine(eventId)).resolves.toBe(
      standing,
    );
  });
});
