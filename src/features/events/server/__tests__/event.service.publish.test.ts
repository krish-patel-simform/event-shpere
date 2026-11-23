import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../../../core/http/errors";
import {
  admin,
  emptyPage,
  eventId,
  eventRecord,
  managedRow,
  NOW,
  organizer,
  otherOrganizer,
  setupEventService,
  venue,
} from "../../__fixtures__/event-service";
import { eventResponseSchema } from "../../schemas/events.schemas";

// Empty factories: the DB client, Strapi client and env are never loaded.
jest.mock("../event.repository", () => ({}));
jest.mock("../../../cms/server", () =>
  jest.requireActual("../../../cms/server/image-upload"),
);
jest.mock("../../../organizer/server", () => ({}));

const paragraph = (text: string) => ({
  type: "paragraph",
  children: [{ type: "text", text }],
});

// NOW is 2 Nov 15:30 in India and the event starts on 12 Dec, so this window is valid: it opens
// tomorrow and closes two days before the start.
const registrationWindow = {
  registrationOpensAt: new Date("2026-11-03T04:00:00.000Z"),
  registrationClosesAt: new Date("2026-12-10T12:00:00.000Z"),
};

/**
 * An event that is ready: a description written, an active hall at the venue, and two live
 * sessions that both have their slot. A test breaks exactly one of these.
 */
function setup() {
  const ctx = setupEventService();
  ctx.repo.findManagedEvent.mockResolvedValue({
    ...managedRow,
    sessionsTotal: 2,
    sessionsScheduled: 2,
    sessionsCancelled: 0,
  });
  ctx.repo.getOverviewExtras.mockResolvedValue({
    hallNames: ["Main Hall"],
    speakerCount: 1,
    sessionBookings: 0,
    seatedSessions: [],
  });
  ctx.strapi.findEventPageById.mockResolvedValue({
    ...emptyPage,
    about: [paragraph("About the forum")],
  });
  return ctx;
}

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe("eventService.publishEvent", () => {
  it("publishes a ready draft at the current time and answers it as published", async () => {
    const { service, repo } = setup();

    const dto = await service.publishEvent(
      eventId,
      organizer,
      registrationWindow,
    );

    expect(repo.publishEvent).toHaveBeenCalledWith(
      eventId,
      NOW,
      registrationWindow,
    );
    expect(() => eventResponseSchema.parse(dto)).not.toThrow();
    expect(dto.status).toBe("published");
    expect(dto).not.toHaveProperty("organizerId");
  });

  it("does not need a cover image or a gallery: a placeholder is shown", async () => {
    const { service, strapi, repo } = setup();
    strapi.findEventPageById.mockResolvedValue({
      ...emptyPage,
      about: [paragraph("About the forum")],
      coverImage: null,
      gallery: [],
    });

    await expect(
      service.publishEvent(eventId, organizer, registrationWindow),
    ).resolves.toBeDefined();
    expect(repo.publishEvent).toHaveBeenCalled();
  });

  describe("who may publish", () => {
    it("refuses an admin (403) before reading anything: an admin does not publish", async () => {
      const { service, repo } = setup();

      await expect(
        service.publishEvent(eventId, admin, registrationWindow),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.findEventById).not.toHaveBeenCalled();
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("answers 404 for another organizer's event and publishes nothing", async () => {
      const { service, repo } = setup();

      await expect(
        service.publishEvent(eventId, otherOrganizer, registrationWindow),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("answers 403 for an organizer an admin has not approved", async () => {
      const { service, verification, repo } = setup();
      verification.assertVerifiedOrganizer.mockRejectedValue(
        new ForbiddenError(
          "Your organizer account is waiting for admin approval",
          "ORGANIZER_NOT_VERIFIED",
        ),
      );

      await expect(
        service.publishEvent(eventId, organizer, registrationWindow),
      ).rejects.toMatchObject({ code: "ORGANIZER_NOT_VERIFIED" });
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("answers 404 for an event that does not exist", async () => {
      const { service, repo } = setup();
      repo.findEventById.mockResolvedValue(null);

      await expect(
        service.publishEvent(eventId, organizer, registrationWindow),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("which events can be published", () => {
    it("answers a published event as it is, without writing again", async () => {
      const { service, repo } = setup();
      repo.findEventById.mockResolvedValue({
        ...eventRecord,
        status: "published",
        publishedAt: NOW,
      });

      const dto = await service.publishEvent(
        eventId,
        organizer,
        registrationWindow,
      );

      expect(dto.status).toBe("published");
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("answers 409 EVENT_CANCELLED for a cancelled event", async () => {
      const { service, repo } = setup();
      repo.findEventById.mockResolvedValue({
        ...eventRecord,
        status: "cancelled",
        publishedAt: NOW,
        cancelledAt: NOW,
      });

      await expect(
        service.publishEvent(eventId, organizer, registrationWindow),
      ).rejects.toMatchObject({ code: "EVENT_CANCELLED" });
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("answers 409 EVENT_ENDED for a draft whose dates are in the past", async () => {
      const { service, repo } = setup();
      repo.findEventById.mockResolvedValue({
        ...eventRecord,
        startAt: new Date("2026-10-30T04:00:00.000Z"),
        endAt: new Date("2026-10-31T12:00:00.000Z"), // before NOW
      });

      await expect(
        service.publishEvent(eventId, organizer, registrationWindow),
      ).rejects.toMatchObject({ code: "EVENT_ENDED" });
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });
  });

  describe("what must be in place", () => {
    async function expectNotReady(
      service: ReturnType<typeof setup>["service"],
      missing: string[],
    ) {
      const failure = await service
        .publishEvent(eventId, organizer, registrationWindow)
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(ConflictError);
      expect(failure).toMatchObject({
        code: "EVENT_NOT_READY",
        details: { missing },
      });
    }

    it("answers 409 EVENT_NOT_READY when the description is missing", async () => {
      const { service, strapi, repo } = setup();
      strapi.findEventPageById.mockResolvedValue(emptyPage);

      await expectNotReady(service, ["content"]);
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("answers 409 when the event has no venue", async () => {
      const { service, repo } = setup();
      repo.findEventById.mockResolvedValue({ ...eventRecord, venueId: null });
      repo.getOverviewExtras.mockResolvedValue({
        hallNames: [],
        speakerCount: 0,
        sessionBookings: 0,
        seatedSessions: [],
      });

      await expectNotReady(service, ["event details", "halls"]);
    });

    it("answers 409 when the venue has no active hall", async () => {
      const { service, repo } = setup();
      repo.getOverviewExtras.mockResolvedValue({
        hallNames: [],
        speakerCount: 0,
        sessionBookings: 0,
        seatedSessions: [],
      });

      await expectNotReady(service, ["halls"]);
    });

    it("answers 409 when the event has no session", async () => {
      const { service, repo } = setup();
      repo.findManagedEvent.mockResolvedValue({
        ...managedRow,
        sessionsTotal: 0,
        sessionsScheduled: 0,
        sessionsCancelled: 0,
      });

      await expectNotReady(service, ["sessions"]);
    });

    it("answers 409 when every session is cancelled", async () => {
      const { service, repo } = setup();
      repo.findManagedEvent.mockResolvedValue({
        ...managedRow,
        sessionsTotal: 2,
        sessionsScheduled: 0,
        sessionsCancelled: 2,
      });

      await expectNotReady(service, ["sessions"]);
    });

    it("answers 409 while a session is still a draft, and says how many", async () => {
      const { service, repo } = setup();
      repo.findManagedEvent.mockResolvedValue({
        ...managedRow,
        sessionsTotal: 3,
        sessionsScheduled: 1,
        sessionsCancelled: 0,
      });

      await expectNotReady(service, ["2 unscheduled sessions"]);
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("lists everything that is missing at once", async () => {
      const { service, strapi, repo } = setup();
      strapi.findEventPageById.mockResolvedValue(emptyPage);
      repo.findManagedEvent.mockResolvedValue({
        ...managedRow,
        sessionsTotal: 0,
        sessionsScheduled: 0,
        sessionsCancelled: 0,
      });

      await expectNotReady(service, ["content", "sessions"]);
    });

    it("answers 409 VENUE_INACTIVE when the venue was switched off", async () => {
      const { service, repo } = setup();
      repo.findVenue.mockResolvedValue({ ...venue, isActive: false });

      await expect(
        service.publishEvent(eventId, organizer, registrationWindow),
      ).rejects.toMatchObject({ code: "VENUE_INACTIVE" });
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("answers 409 when a session is outside the event's dates", async () => {
      const { service, repo } = setup();
      repo.countSessionsOutside.mockResolvedValue(1);

      await expect(
        service.publishEvent(eventId, organizer, registrationWindow),
      ).rejects.toMatchObject({ code: "SESSIONS_OUTSIDE_DATES" });
      expect(repo.countSessionsOutside).toHaveBeenCalledWith(
        eventId,
        eventRecord.startAt,
        eventRecord.endAt,
      );
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("answers 409 when a session is in a hall of another venue", async () => {
      const { service, repo } = setup();
      repo.countSessionsInOtherVenue.mockResolvedValue(1);

      await expect(
        service.publishEvent(eventId, organizer, registrationWindow),
      ).rejects.toMatchObject({ code: "SESSIONS_IN_OTHER_VENUE" });
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("answers 503 when the CMS is down, and never publishes on a guess", async () => {
      const { service, strapi, repo } = setup();
      strapi.findEventPageById.mockRejectedValue(
        new Error("connect ECONNREFUSED"),
      );

      await expect(
        service.publishEvent(eventId, organizer, registrationWindow),
      ).rejects.toBeInstanceOf(ServiceUnavailableError);
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });
  });

  describe("two publishes at the same moment", () => {
    it("answers the published event too when someone else published it a moment earlier", async () => {
      const { service, repo } = setup();
      repo.publishEvent.mockResolvedValue(null);
      repo.findEventRecord.mockResolvedValue({
        ...eventRecord,
        status: "published",
        publishedAt: new Date("2026-11-02T09:59:59.000Z"),
      });

      const dto = await service.publishEvent(
        eventId,
        organizer,
        registrationWindow,
      );

      expect(dto.status).toBe("published");
    });

    it("answers 409 EVENT_NOT_DRAFT when it was cancelled between the read and the write", async () => {
      const { service, repo } = setup();
      repo.publishEvent.mockResolvedValue(null);
      repo.findEventRecord.mockResolvedValue({
        ...eventRecord,
        status: "cancelled",
        publishedAt: NOW,
        cancelledAt: NOW,
      });

      await expect(
        service.publishEvent(eventId, organizer, registrationWindow),
      ).rejects.toMatchObject({ code: "EVENT_NOT_DRAFT" });
    });

    it("answers 404 if the event vanished between the read and the write", async () => {
      const { service, repo } = setup();
      repo.publishEvent.mockResolvedValue(null);
      repo.findEventRecord.mockResolvedValue(null);

      await expect(
        service.publishEvent(eventId, organizer, registrationWindow),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("the registration window", () => {
    // 2 Nov 03:30 in India, but still 1 Nov in New York (and in UTC).
    const earlyToday = new Date("2026-11-01T22:00:00.000Z");
    const eventStart = eventRecord.startAt;

    async function publishWith(
      window: typeof registrationWindow,
      event: Partial<typeof eventRecord> = {},
    ) {
      const ctx = setup();
      ctx.repo.findEventById.mockResolvedValue({ ...eventRecord, ...event });
      const failure = await ctx.service
        .publishEvent(eventId, organizer, window)
        .then(() => null)
        .catch((error: unknown) => error);
      return { ...ctx, failure };
    }

    it("saves the dates with the status, so a published event always has them", async () => {
      const { repo, failure } = await publishWith(registrationWindow);

      expect(failure).toBeNull();
      expect(repo.publishEvent).toHaveBeenCalledWith(eventId, NOW, {
        registrationOpensAt: registrationWindow.registrationOpensAt,
        registrationClosesAt: registrationWindow.registrationClosesAt,
      });
    });

    it("lets registration open earlier today: today is the event's day, not the server's", async () => {
      const { repo, failure } = await publishWith({
        ...registrationWindow,
        registrationOpensAt: earlyToday,
      });

      expect(failure).toBeNull();
      expect(repo.publishEvent).toHaveBeenCalled();
    });

    it("refuses an opening day before today with a 400 on that field", async () => {
      const { failure, repo } = await publishWith({
        ...registrationWindow,
        registrationOpensAt: new Date("2026-11-01T10:00:00.000Z"), // 1 Nov in India
      });

      expect(failure).toBeInstanceOf(ValidationError);
      expect(failure).toMatchObject({
        status: 400,
        details: {
          fieldErrors: { registrationOpensAt: expect.any(Array) },
        },
      });
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("counts today in the event's own zone: the same moment is yesterday in New York", async () => {
      const { failure } = await publishWith(
        { ...registrationWindow, registrationOpensAt: earlyToday },
        { timezone: "America/New_York" },
      );

      expect(failure).toMatchObject({
        details: { fieldErrors: { registrationOpensAt: expect.any(Array) } },
      });
    });

    it("refuses an opening at or after the event's start", async () => {
      const { failure } = await publishWith({
        ...registrationWindow,
        registrationOpensAt: eventStart,
      });

      expect(failure).toMatchObject({
        details: { fieldErrors: { registrationOpensAt: expect.any(Array) } },
      });
    });

    it.each([
      ["exactly when the event starts", eventStart],
      ["after the event starts", new Date(eventStart.getTime() + 60_000)],
    ])("refuses a closing %s", async (_label, closesAt) => {
      const { failure, repo } = await publishWith({
        ...registrationWindow,
        registrationClosesAt: closesAt,
      });

      expect(failure).toMatchObject({
        details: { fieldErrors: { registrationClosesAt: expect.any(Array) } },
      });
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });

    it("refuses a closing time that has already passed", async () => {
      const { failure } = await publishWith({
        registrationOpensAt: earlyToday,
        registrationClosesAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      });

      expect(failure).toMatchObject({
        details: { fieldErrors: { registrationClosesAt: expect.any(Array) } },
      });
    });

    it("reports both fields at once when both are wrong", async () => {
      const { failure } = await publishWith({
        registrationOpensAt: new Date("2026-11-01T10:00:00.000Z"),
        registrationClosesAt: new Date(eventStart.getTime() + 60_000),
      });

      expect(failure).toMatchObject({
        details: {
          fieldErrors: {
            registrationOpensAt: expect.any(Array),
            registrationClosesAt: expect.any(Array),
          },
        },
      });
    });

    it("checks the dates before it asks the CMS anything", async () => {
      const { strapi, failure } = await publishWith({
        ...registrationWindow,
        registrationClosesAt: eventStart,
      });

      expect(failure).toBeInstanceOf(ValidationError);
      expect(strapi.findEventPageById).not.toHaveBeenCalled();
    });

    it("ignores the dates of an event that is already published", async () => {
      const { failure, repo } = await publishWith(
        { ...registrationWindow, registrationClosesAt: eventStart },
        { status: "published", publishedAt: NOW },
      );

      expect(failure).toBeNull();
      expect(repo.publishEvent).not.toHaveBeenCalled();
    });
  });
});
