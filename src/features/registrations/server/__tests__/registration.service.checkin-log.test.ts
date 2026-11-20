import { PERMISSION } from "../../../../core/auth/permission-catalog";
import { ForbiddenError, NotFoundError } from "../../../../core/http/errors";
import {
  adminActor,
  checkInLogRow,
  eventId,
  organizerActor,
  setupRegistrationService,
} from "../../__fixtures__/registration-service";
import {
  checkInListQuerySchema,
  checkInLogMetaSchema,
  checkInLogResponseSchema,
} from "../../schemas/check-ins.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const defaultQuery = checkInListQuerySchema.parse({});
const counts = { registered: 250, cancelled: 4, checkedIn: 142 };

describe("registrationService.listCheckIns", () => {
  describe("who may look", () => {
    it("lets an organizer read the log of an event they own", async () => {
      const { service, eventAccess } = setupRegistrationService();

      await service.listCheckIns(eventId, defaultQuery, organizerActor);

      expect(eventAccess.getEventIfOrgOwns).toHaveBeenCalledWith(
        eventId,
        organizerActor,
        { write: false },
      );
    });

    it("lets an admin read the log of any event", async () => {
      const { service, repo } = setupRegistrationService();

      await service.listCheckIns(eventId, defaultQuery, adminActor);

      expect(repo.listCheckIns).toHaveBeenCalledTimes(1);
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
        service.listCheckIns(eventId, defaultQuery, attendee),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(eventAccess.getEventIfOrgOwns).not.toHaveBeenCalled();
      expect(repo.listCheckIns).not.toHaveBeenCalled();
      expect(repo.countAttendees).not.toHaveBeenCalled();
    });

    it("answers 404 for an event the organizer does not own, and reads nothing", async () => {
      const { service, repo, eventAccess } = setupRegistrationService();
      eventAccess.getEventIfOrgOwns.mockRejectedValue(
        new NotFoundError("Event not found"),
      );

      await expect(
        service.listCheckIns(eventId, defaultQuery, organizerActor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.listCheckIns).not.toHaveBeenCalled();
      expect(repo.countAttendees).not.toHaveBeenCalled();
    });

    it("passes on the error when the organizer is not approved, and reads nothing", async () => {
      const { service, repo, eventAccess } = setupRegistrationService();
      const refusal = new ForbiddenError();
      eventAccess.getEventIfOrgOwns.mockRejectedValue(refusal);

      await expect(
        service.listCheckIns(eventId, defaultQuery, organizerActor),
      ).rejects.toBe(refusal);
      expect(repo.listCheckIns).not.toHaveBeenCalled();
    });
  });

  describe("the page", () => {
    it("asks the repository for this event's page, with its filters and the sort", async () => {
      const { service, repo } = setupRegistrationService();

      await service.listCheckIns(
        eventId,
        {
          page: 3,
          pageSize: 10,
          search: "priya",
          date: "2026-12-12",
          sort: "name",
        },
        organizerActor,
      );

      expect(repo.listCheckIns).toHaveBeenCalledWith({
        eventId,
        sort: "name",
        date: "2026-12-12",
        search: "priya",
        limit: 10,
        offset: 20,
      });
    });

    it("treats an empty search as no search", async () => {
      const { service, repo } = setupRegistrationService();

      await service.listCheckIns(
        eventId,
        { ...defaultQuery, search: "" },
        organizerActor,
      );

      expect(repo.listCheckIns.mock.calls[0][0].search).toBeUndefined();
    });

    it("answers the meta with the filtered total and the people counts of the whole event", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listCheckIns.mockResolvedValue({ rows: [checkInLogRow], total: 9 });
      repo.countAttendees.mockResolvedValue(counts);

      const { meta } = await service.listCheckIns(
        eventId,
        { ...defaultQuery, page: 2, pageSize: 5, search: "priya" },
        organizerActor,
      );

      expect(meta).toEqual({
        page: 2,
        pageSize: 5,
        total: 9,
        counts: { checkedIn: 142, registered: 250 },
      });
      expect(repo.countAttendees).toHaveBeenCalledWith(eventId);
      expect(() => checkInLogMetaSchema.parse(meta)).not.toThrow();
    });

    it("answers an empty page for an event nobody has checked in to", async () => {
      const { service } = setupRegistrationService();

      await expect(
        service.listCheckIns(eventId, defaultQuery, organizerActor),
      ).resolves.toEqual({
        items: [],
        meta: {
          page: 1,
          pageSize: 10,
          total: 0,
          counts: { checkedIn: 0, registered: 0 },
        },
      });
    });
  });

  describe("each row", () => {
    it("holds the person, the day, the time, the method and who checked them in", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listCheckIns.mockResolvedValue({ rows: [checkInLogRow], total: 1 });

      const { items } = await service.listCheckIns(
        eventId,
        defaultQuery,
        organizerActor,
      );

      expect(items).toEqual([
        {
          id: checkInLogRow.id,
          registrationId: checkInLogRow.registrationId,
          attendanceDate: "2026-12-12",
          checkedInAt: "2026-12-12T03:30:00.000Z",
          method: "manual",
          attendee: {
            firstName: "Priya",
            lastName: "Shah",
            email: "priya@example.com",
            ticketCode: "ESEVT7K3Q9P",
          },
          checkedInBy: { firstName: "Omkar", lastName: "Patil" },
        },
      ]);
    });

    it("shows nobody as the checker when none is recorded", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listCheckIns.mockResolvedValue({
        rows: [
          {
            ...checkInLogRow,
            checkedByFirstName: null,
            checkedByLastName: null,
          },
        ],
        total: 1,
      });

      const { items } = await service.listCheckIns(
        eventId,
        defaultQuery,
        adminActor,
      );

      expect(items[0].checkedInBy).toBeNull();
    });

    it("keeps one row per check-in: a person checked in on two days is listed twice", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listCheckIns.mockResolvedValue({
        rows: [
          { ...checkInLogRow, attendanceDate: "2026-12-13" },
          checkInLogRow,
        ],
        total: 2,
      });

      const { items } = await service.listCheckIns(
        eventId,
        defaultQuery,
        organizerActor,
      );

      expect(items.map((item) => item.attendanceDate)).toEqual([
        "2026-12-13",
        "2026-12-12",
      ]);
      expect(items[0].registrationId).toBe(items[1].registrationId);
    });

    it("matches the response schema and carries no user id", async () => {
      const { service, repo } = setupRegistrationService();
      repo.listCheckIns.mockResolvedValue({ rows: [checkInLogRow], total: 1 });

      const { items } = await service.listCheckIns(
        eventId,
        defaultQuery,
        organizerActor,
      );

      expect(() => checkInLogResponseSchema.parse(items)).not.toThrow();
      expect(Object.keys(items[0]).sort()).toEqual([
        "attendanceDate",
        "attendee",
        "checkedInAt",
        "checkedInBy",
        "id",
        "method",
        "registrationId",
      ]);
      expect(Object.keys(items[0].checkedInBy ?? {}).sort()).toEqual([
        "firstName",
        "lastName",
      ]);
    });
  });
});

describe("checkInListQuerySchema", () => {
  it("defaults to the first page of ten, every day, newest first", () => {
    expect(checkInListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 10,
      sort: "newest",
    });
  });

  it("turns the numbers into numbers, trims the search and accepts a date", () => {
    expect(
      checkInListQuerySchema.parse({
        page: "2",
        pageSize: "25",
        search: "  priya ",
        date: "2026-12-12",
        sort: "oldest",
      }),
    ).toEqual({
      page: 2,
      pageSize: 25,
      search: "priya",
      date: "2026-12-12",
      sort: "oldest",
    });
  });

  it("accepts every sort", () => {
    for (const sort of ["newest", "oldest", "name"]) {
      expect(checkInListQuerySchema.safeParse({ sort }).success).toBe(true);
    }
  });

  it.each([
    ["page 0", { page: "0" }],
    ["page size 0", { pageSize: "0" }],
    ["page size over 50", { pageSize: "51" }],
    ["an unknown sort", { sort: "random" }],
    ["a date that is not a date", { date: "tomorrow" }],
    ["a date with a time", { date: "2026-12-12T10:00:00Z" }],
    ["an impossible date", { date: "2026-13-45" }],
    ["a search over 100 characters", { search: "x".repeat(101) }],
  ])("rejects %s", (_name, query) => {
    expect(checkInListQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("checkInLogMetaSchema", () => {
  it("accepts the paging fields with the people counts", () => {
    expect(
      checkInLogMetaSchema.safeParse({
        page: 1,
        pageSize: 10,
        total: 0,
        counts: { checkedIn: 0, registered: 0 },
      }).success,
    ).toBe(true);
  });

  it("rejects negative counts", () => {
    expect(
      checkInLogMetaSchema.safeParse({
        page: 1,
        pageSize: 10,
        total: 0,
        counts: { checkedIn: -1, registered: 0 },
      }).success,
    ).toBe(false);
  });
});
