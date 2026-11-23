import { PERMISSION } from "../../../../core/auth/permission-catalog";
import { ForbiddenError, NotFoundError } from "../../../../core/http/errors";
import {
  adminActor,
  attendeeRow,
  eventId,
  organizerActor,
  setupRegistrationService,
} from "../../__fixtures__/registration-service";
import {
  attendeeListMetaSchema,
  attendeeListQuerySchema,
  attendeeListResponseSchema,
} from "../../schemas/attendees.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const defaultQuery = attendeeListQuerySchema.parse({});
const counts = { registered: 7, cancelled: 2, checkedIn: 3, pending: 4 };

describe("registrationService.listAttendees", () => {
  describe("who may look", () => {
    it("lets an organizer list the attendees of an event they own", async () => {
      const { service, eventAccess } = setupRegistrationService();

      await service.listAttendees(eventId, defaultQuery, organizerActor);

      expect(eventAccess.getEventIfOrgOwns).toHaveBeenCalledWith(
        eventId,
        organizerActor,
        { write: false },
      );
    });

    it("lets an admin list the attendees of any event", async () => {
      const { service, repo } = setupRegistrationService();

      await service.listAttendees(eventId, defaultQuery, adminActor);

      expect(repo.listAttendees).toHaveBeenCalledTimes(1);
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
        service.listAttendees(eventId, defaultQuery, attendee),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(eventAccess.getEventIfOrgOwns).not.toHaveBeenCalled();
      expect(repo.listAttendees).not.toHaveBeenCalled();
      expect(repo.countAttendees).not.toHaveBeenCalled();
    });

    it("answers 404 for an event the organizer does not own, and reads nothing", async () => {
      const { service, repo, eventAccess } = setupRegistrationService();
      eventAccess.getEventIfOrgOwns.mockRejectedValue(
        new NotFoundError("Event not found"),
      );

      await expect(
        service.listAttendees(eventId, defaultQuery, organizerActor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.listAttendees).not.toHaveBeenCalled();
      expect(repo.countAttendees).not.toHaveBeenCalled();
    });

    it("passes on the error when the organizer is not approved, and reads nothing", async () => {
      const { service, repo, eventAccess } = setupRegistrationService();
      const refusal = new ForbiddenError();
      eventAccess.getEventIfOrgOwns.mockRejectedValue(refusal);

      await expect(
        service.listAttendees(eventId, defaultQuery, organizerActor),
      ).rejects.toBe(refusal);
      expect(repo.listAttendees).not.toHaveBeenCalled();
    });
  });

  describe("the page", () => {
    it("asks the repository for this event's page and turns page into limit and offset", async () => {
      const { service, repo } = setupRegistrationService();

      await service.listAttendees(
        eventId,
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

      expect(repo.listAttendees).toHaveBeenCalledWith({
        eventId,
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

      // The schema trims, so a blank search reaches the service as an empty string.
      await service.listAttendees(
        eventId,
        { ...defaultQuery, search: "" },
        organizerActor,
      );

      expect(repo.listAttendees.mock.calls[0][0].search).toBeUndefined();
    });

    it("answers the meta with the filtered total and the counts of the whole event", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listAttendees.mockResolvedValue({ rows: [attendeeRow], total: 4 });
      repo.countAttendees.mockResolvedValue(counts);

      const { meta } = await service.listAttendees(
        eventId,
        { ...defaultQuery, page: 2, pageSize: 5, search: "priya" },
        organizerActor,
      );

      // checkInOpensHoursBefore: the production default (6) when the service gets none.
      expect(meta).toEqual({
        page: 2,
        pageSize: 5,
        total: 4,
        counts,
        checkInOpensHoursBefore: 6,
      });
      // No `date` was asked, so the counts are for any day.
      expect(repo.countAttendees).toHaveBeenCalledWith(eventId, undefined);
      expect(() => attendeeListMetaSchema.parse(meta)).not.toThrow();
    });

    it("answers an empty page for an event nobody registered for", async () => {
      const { service } = setupRegistrationService();

      await expect(
        service.listAttendees(eventId, defaultQuery, organizerActor),
      ).resolves.toEqual({
        items: [],
        meta: {
          page: 1,
          pageSize: 10,
          total: 0,
          counts: { registered: 0, cancelled: 0, checkedIn: 0, pending: 0 },
          checkInOpensHoursBefore: 6,
        },
      });
    });

    it("sends the door's setting it was built with, so the door screen opens the same days as the server", async () => {
      const { service } = setupRegistrationService(undefined, {
        checkInOpensHoursBefore: 8760,
        sessionCheckInOpensHoursBefore: 2,
      });

      const { meta } = await service.listAttendees(
        eventId,
        defaultQuery,
        organizerActor,
      );

      expect(meta.checkInOpensHoursBefore).toBe(8760);
    });
  });

  describe("one event day", () => {
    it("asks for that day's check-ins and that day's counts", async () => {
      const { service, repo } = setupRegistrationService();

      await service.listAttendees(
        eventId,
        { ...defaultQuery, checkedIn: "no", date: "2026-12-13" },
        organizerActor,
      );

      expect(repo.listAttendees).toHaveBeenCalledWith(
        expect.objectContaining({ checkedIn: "no", date: "2026-12-13" }),
      );
      expect(repo.countAttendees).toHaveBeenCalledWith(eventId, "2026-12-13");
    });

    it("passes no day when none was asked, so 'checked in' means any day", async () => {
      const { service, repo } = setupRegistrationService();

      await service.listAttendees(
        eventId,
        { ...defaultQuery, checkedIn: "yes" },
        organizerActor,
      );

      expect(repo.listAttendees.mock.calls[0][0].date).toBeUndefined();
    });
  });

  describe("sorting by the last check-in", () => {
    it("passes the sort on to the repository", async () => {
      const { service, repo } = setupRegistrationService();

      await service.listAttendees(
        eventId,
        { ...defaultQuery, sort: "checkedIn" },
        organizerActor,
      );

      expect(repo.listAttendees).toHaveBeenCalledWith(
        expect.objectContaining({ sort: "checkedIn" }),
      );
    });
  });

  describe("each attendee", () => {
    it("shows who checked the person in, by name only, and how", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listAttendees.mockResolvedValue({
        rows: [
          {
            ...attendeeRow,
            checkedInAt: new Date("2026-12-12T04:30:00.000Z"),
            checkedByFirstName: "Omkar",
            checkedByLastName: "Patil",
            checkInMethod: "manual",
          },
        ],
        total: 1,
      });

      const { items } = await service.listAttendees(
        eventId,
        defaultQuery,
        organizerActor,
      );

      expect(items[0]).toMatchObject({
        checkedInAt: "2026-12-12T04:30:00.000Z",
        checkedInBy: { firstName: "Omkar", lastName: "Patil" },
        checkInMethod: "manual",
      });
      expect(Object.keys(items[0].checkedInBy ?? {}).sort()).toEqual([
        "firstName",
        "lastName",
      ]);
    });

    it("shows nobody as the checker when none is recorded, but still the method", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listAttendees.mockResolvedValue({
        rows: [
          {
            ...attendeeRow,
            checkedInAt: new Date("2026-12-12T04:30:00.000Z"),
            checkInMethod: "qr_scan",
          },
        ],
        total: 1,
      });

      const { items } = await service.listAttendees(
        eventId,
        defaultQuery,
        organizerActor,
      );

      expect(items[0].checkedInBy).toBeNull();
      expect(items[0].checkInMethod).toBe("qr_scan");
    });

    it("holds the person, the ticket and the dates as ISO strings", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listAttendees.mockResolvedValue({ rows: [attendeeRow], total: 1 });

      const { items } = await service.listAttendees(
        eventId,
        defaultQuery,
        organizerActor,
      );

      expect(items).toEqual([
        {
          registrationId: attendeeRow.registrationId,
          firstName: "Priya",
          lastName: "Shah",
          email: "priya@example.com",
          ticketCode: "ESEVT7K3Q9P",
          status: "registered",
          registeredAt: "2026-11-01T08:00:00.000Z",
          checkedInAt: null,
          checkedInBy: null,
          checkInMethod: null,
        },
      ]);
    });

    it("shows when the person checked in", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listAttendees.mockResolvedValue({
        rows: [
          {
            ...attendeeRow,
            checkedInAt: new Date("2026-12-12T04:30:00.000Z"),
          },
        ],
        total: 1,
      });

      const { items } = await service.listAttendees(
        eventId,
        defaultQuery,
        organizerActor,
      );

      expect(items[0].checkedInAt).toBe("2026-12-12T04:30:00.000Z");
    });

    it("lists a cancelled registration as cancelled", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listAttendees.mockResolvedValue({
        rows: [{ ...attendeeRow, status: "cancelled" }],
        total: 1,
      });

      const { items } = await service.listAttendees(
        eventId,
        defaultQuery,
        adminActor,
      );

      expect(items[0].status).toBe("cancelled");
    });

    it("matches the response schema and carries no user id, password or token", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listAttendees.mockResolvedValue({ rows: [attendeeRow], total: 1 });

      const { items } = await service.listAttendees(
        eventId,
        defaultQuery,
        organizerActor,
      );

      expect(() => attendeeListResponseSchema.parse(items)).not.toThrow();
      expect(Object.keys(items[0]).sort()).toEqual([
        "checkInMethod",
        "checkedInAt",
        "checkedInBy",
        "email",
        "firstName",
        "lastName",
        "registeredAt",
        "registrationId",
        "status",
        "ticketCode",
      ]);
    });
  });
});
