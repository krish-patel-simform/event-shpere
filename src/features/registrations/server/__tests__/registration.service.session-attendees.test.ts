import { PERMISSION } from "../../../../core/auth/permission-catalog";
import { ForbiddenError, NotFoundError } from "../../../../core/http/errors";
import {
  adminActor,
  eventId,
  organizerActor,
  sessionAttendeeRow,
  sessionId,
  setupRegistrationService,
} from "../../__fixtures__/registration-service";
import {
  attendeeListQuerySchema,
  sessionAttendeeListMetaSchema,
  sessionAttendeeListResponseSchema,
} from "../../schemas/attendees.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const defaultQuery = attendeeListQuerySchema.parse({});
const counts = { registered: 25, cancelled: 3, checkedIn: 12, pending: 13 };

describe("registrationService.listSessionAttendees", () => {
  describe("who may look", () => {
    it("lets an organizer list the seats of a session of an event they own", async () => {
      const { service, eventAccess } = setupRegistrationService();

      await service.listSessionAttendees(
        eventId,
        sessionId,
        defaultQuery,
        organizerActor,
      );

      expect(eventAccess.getEventIfOrgOwns).toHaveBeenCalledWith(
        eventId,
        organizerActor,
        { write: false },
      );
    });

    it("lets an admin list the seats of any session", async () => {
      const { service, repo } = setupRegistrationService();

      await service.listSessionAttendees(
        eventId,
        sessionId,
        defaultQuery,
        adminActor,
      );

      expect(repo.listSessionAttendees).toHaveBeenCalledTimes(1);
    });

    it("answers 403 to a role with neither permission, and reads nothing", async () => {
      const { service, repo, eventAccess } = setupRegistrationService();
      const attendee = {
        ...organizerActor,
        role: "user" as const,
        permissions: new Set([
          PERMISSION.REGISTRATION_CREATE,
          PERMISSION.REGISTRATION_VIEW_OWN,
        ]),
      };

      await expect(
        service.listSessionAttendees(
          eventId,
          sessionId,
          defaultQuery,
          attendee,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(eventAccess.getEventIfOrgOwns).not.toHaveBeenCalled();
      expect(repo.sessionExistsInEvent).not.toHaveBeenCalled();
      expect(repo.listSessionAttendees).not.toHaveBeenCalled();
    });

    it("answers 404 for an event the organizer does not own, and reads nothing", async () => {
      const { service, repo, eventAccess } = setupRegistrationService();
      eventAccess.getEventIfOrgOwns.mockRejectedValue(
        new NotFoundError("Event not found"),
      );

      await expect(
        service.listSessionAttendees(
          eventId,
          sessionId,
          defaultQuery,
          organizerActor,
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.listSessionAttendees).not.toHaveBeenCalled();
      expect(repo.countSessionAttendees).not.toHaveBeenCalled();
    });

    it("passes on the error when the organizer is not approved, and reads nothing", async () => {
      const { service, repo, eventAccess } = setupRegistrationService();
      const refusal = new ForbiddenError();
      eventAccess.getEventIfOrgOwns.mockRejectedValue(refusal);

      await expect(
        service.listSessionAttendees(
          eventId,
          sessionId,
          defaultQuery,
          organizerActor,
        ),
      ).rejects.toBe(refusal);
      expect(repo.listSessionAttendees).not.toHaveBeenCalled();
    });

    it("answers 404 for a session that is not in this event, and reads nothing", async () => {
      const { service, repo } = setupRegistrationService();
      repo.sessionExistsInEvent.mockResolvedValue(false);

      await expect(
        service.listSessionAttendees(
          eventId,
          sessionId,
          defaultQuery,
          organizerActor,
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.sessionExistsInEvent).toHaveBeenCalledWith(
        eventId,
        sessionId,
      );
      expect(repo.listSessionAttendees).not.toHaveBeenCalled();
      expect(repo.countSessionAttendees).not.toHaveBeenCalled();
    });
  });

  describe("the page", () => {
    it("asks the repository for this session's page and turns page into limit and offset", async () => {
      const { service, repo } = setupRegistrationService();

      await service.listSessionAttendees(
        eventId,
        sessionId,
        {
          page: 3,
          pageSize: 10,
          status: "registered",
          checkedIn: "no",
          sort: "name",
          search: "priya",
        },
        organizerActor,
      );

      expect(repo.listSessionAttendees).toHaveBeenCalledWith({
        eventId,
        sessionId,
        status: "registered",
        checkedIn: "no",
        sort: "name",
        search: "priya",
        limit: 10,
        offset: 20,
      });
    });

    it("treats a search of only spaces as no search", async () => {
      const { service, repo } = setupRegistrationService();

      await service.listSessionAttendees(
        eventId,
        sessionId,
        { ...defaultQuery, search: "" },
        organizerActor,
      );

      expect(repo.listSessionAttendees.mock.calls[0][0].search).toBeUndefined();
    });

    it("answers the meta with the filtered total and the counts of the whole session", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listSessionAttendees.mockResolvedValue({
        rows: [sessionAttendeeRow],
        total: 13,
      });
      repo.countSessionAttendees.mockResolvedValue(counts);

      const { meta } = await service.listSessionAttendees(
        eventId,
        sessionId,
        { ...defaultQuery, page: 2, pageSize: 5, checkedIn: "no" },
        organizerActor,
      );

      // checkInOpensHoursBefore: the SESSION setting's production default (2).
      expect(meta).toEqual({
        page: 2,
        pageSize: 5,
        total: 13,
        counts,
        checkInOpensHoursBefore: 2,
      });
      expect(repo.countSessionAttendees).toHaveBeenCalledWith(sessionId);
      expect(() => sessionAttendeeListMetaSchema.parse(meta)).not.toThrow();
    });

    it("answers an empty page for a session nobody booked", async () => {
      const { service } = setupRegistrationService();

      await expect(
        service.listSessionAttendees(
          eventId,
          sessionId,
          defaultQuery,
          organizerActor,
        ),
      ).resolves.toEqual({
        items: [],
        meta: {
          page: 1,
          pageSize: 10,
          total: 0,
          counts: { registered: 0, cancelled: 0, checkedIn: 0, pending: 0 },
          checkInOpensHoursBefore: 2,
        },
      });
    });

    it("sends the SESSION door's setting, not the event day's", async () => {
      const { service } = setupRegistrationService(undefined, {
        checkInOpensHoursBefore: 6,
        sessionCheckInOpensHoursBefore: 8760,
      });

      const { meta } = await service.listSessionAttendees(
        eventId,
        sessionId,
        defaultQuery,
        organizerActor,
      );

      expect(meta.checkInOpensHoursBefore).toBe(8760);
    });
  });

  describe("each seat", () => {
    it("holds the person, the ticket and the dates as ISO strings", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listSessionAttendees.mockResolvedValue({
        rows: [sessionAttendeeRow],
        total: 1,
      });

      const { items } = await service.listSessionAttendees(
        eventId,
        sessionId,
        defaultQuery,
        organizerActor,
      );

      expect(items).toEqual([
        {
          bookingId: sessionAttendeeRow.bookingId,
          firstName: "Priya",
          lastName: "Shah",
          email: "priya@example.com",
          ticketCode: "ESEVT7K3Q9P",
          status: "registered",
          bookedAt: sessionAttendeeRow.bookedAt.toISOString(),
          checkedInAt: null,
        },
      ]);
    });

    it("shows when the person checked in to the session", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listSessionAttendees.mockResolvedValue({
        rows: [
          {
            ...sessionAttendeeRow,
            checkedInAt: new Date("2026-12-12T04:30:00.000Z"),
          },
        ],
        total: 1,
      });

      const { items } = await service.listSessionAttendees(
        eventId,
        sessionId,
        defaultQuery,
        adminActor,
      );

      expect(items[0].checkedInAt).toBe("2026-12-12T04:30:00.000Z");
    });

    it("lists a cancelled seat as cancelled", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listSessionAttendees.mockResolvedValue({
        rows: [{ ...sessionAttendeeRow, status: "cancelled" }],
        total: 1,
      });

      const { items } = await service.listSessionAttendees(
        eventId,
        sessionId,
        defaultQuery,
        organizerActor,
      );

      expect(items[0].status).toBe("cancelled");
    });

    it("matches the response schema and carries no user id, password or token", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listSessionAttendees.mockResolvedValue({
        rows: [sessionAttendeeRow],
        total: 1,
      });

      const { items } = await service.listSessionAttendees(
        eventId,
        sessionId,
        defaultQuery,
        organizerActor,
      );

      expect(() =>
        sessionAttendeeListResponseSchema.parse(items),
      ).not.toThrow();
      expect(Object.keys(items[0]).sort()).toEqual([
        "bookedAt",
        "bookingId",
        "checkedInAt",
        "email",
        "firstName",
        "lastName",
        "status",
        "ticketCode",
      ]);
    });
  });
});

describe("sessionAttendeeListMetaSchema", () => {
  it("accepts the paging fields with the session's counts and the door's setting", () => {
    expect(
      sessionAttendeeListMetaSchema.safeParse({
        page: 1,
        pageSize: 10,
        total: 0,
        counts: { registered: 0, cancelled: 0, checkedIn: 0, pending: 0 },
        checkInOpensHoursBefore: 2,
      }).success,
    ).toBe(true);
  });

  it("needs the door's setting, a positive number of hours", () => {
    const meta = {
      page: 1,
      pageSize: 10,
      total: 0,
      counts: { registered: 0, cancelled: 0, checkedIn: 0, pending: 0 },
    };
    expect(sessionAttendeeListMetaSchema.safeParse(meta).success).toBe(false);
    expect(
      sessionAttendeeListMetaSchema.safeParse({
        ...meta,
        checkInOpensHoursBefore: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects negative counts and a missing pending count", () => {
    expect(
      sessionAttendeeListMetaSchema.safeParse({
        page: 1,
        pageSize: 10,
        total: 0,
        counts: { registered: 0, cancelled: 0, checkedIn: -1, pending: 0 },
      }).success,
    ).toBe(false);
    expect(
      sessionAttendeeListMetaSchema.safeParse({
        page: 1,
        pageSize: 10,
        total: 0,
        counts: { registered: 0, cancelled: 0, checkedIn: 0 },
      }).success,
    ).toBe(false);
  });
});
