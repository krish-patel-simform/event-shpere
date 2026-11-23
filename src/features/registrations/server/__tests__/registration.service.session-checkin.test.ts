import { PERMISSION } from "../../../../core/auth/permission-catalog";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../../core/http/errors";
import {
  adminActor,
  bookableSession,
  cancelledBooking,
  eventCheckInRow,
  eventId,
  heldBooking,
  organizerActor,
  publishedEvent,
  sessionCheckInRow,
  sessionId,
  setupRegistrationService,
  ticketHolder,
} from "../../__fixtures__/registration-service";
import {
  checkInBodySchema,
  sessionCheckInResponseSchema,
} from "../../schemas/check-ins.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const HOUR = 60 * 60 * 1000;
const body = checkInBodySchema.parse({ ticketCode: "esevt7k3q9p" });

// The session runs 05:00 to 07:00 UTC; the event starts at 04:00 UTC. The door is open from
// 03:00 UTC (2 hours before the session) until 07:00 UTC.
const startAt = bookableSession.startAt!;
const endAt = bookableSession.endAt!;
const AT_THE_DOOR = new Date(startAt.getTime() - 30 * 60 * 1000);

/** The service at the door: the ticket is found, it holds a seat, and the person came in today. */
function setupAtDoor(
  now: Date = AT_THE_DOOR,
  options: { sessionCheckInOpensHoursBefore?: number } = {},
) {
  const setup = setupRegistrationService(now, options);
  setup.repo.findRegistrationByTicketCode.mockResolvedValue(ticketHolder);
  setup.repo.findSessionBooking.mockResolvedValue(heldBooking);
  return setup;
}

/** The check-in was refused: a 409 with this code, and nothing was written. */
async function expectRefused(
  attempt: Promise<unknown>,
  code: string,
  insert: jest.Mock,
) {
  const failure = await attempt.catch((e) => e);
  expect(failure).toBeInstanceOf(ConflictError);
  expect(failure).toMatchObject({ status: 409, code });
  expect(insert).not.toHaveBeenCalled();
}

describe("registrationService.checkInToSession", () => {
  describe("who may check in", () => {
    it("lets an organizer check in at an event they own", async () => {
      const { service, eventAccess } = setupAtDoor();

      await service.checkInToSession(eventId, sessionId, body, organizerActor);

      expect(eventAccess.getEventIfOrgOwns).toHaveBeenCalledWith(
        eventId,
        organizerActor,
        { write: false },
      );
    });

    it("lets an admin check in at any event", async () => {
      const { service, repo } = setupAtDoor();

      await service.checkInToSession(eventId, sessionId, body, adminActor);

      expect(repo.insertSessionCheckIn).toHaveBeenCalledTimes(1);
    });

    it("answers 403 to a role with neither permission, and reads nothing", async () => {
      const { service, repo, eventAccess } = setupAtDoor();
      const attendee = {
        ...organizerActor,
        role: "user" as const,
        permissions: new Set([PERMISSION.REGISTRATION_CREATE]),
      };

      await expect(
        service.checkInToSession(eventId, sessionId, body, attendee),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(eventAccess.getEventIfOrgOwns).not.toHaveBeenCalled();
      expect(repo.transaction).not.toHaveBeenCalled();
    });

    it("answers 404 for an event the organizer does not own, and writes nothing", async () => {
      const { service, repo, eventAccess } = setupAtDoor();
      eventAccess.getEventIfOrgOwns.mockRejectedValue(
        new NotFoundError("Event not found"),
      );

      await expect(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.transaction).not.toHaveBeenCalled();
      expect(repo.insertSessionCheckIn).not.toHaveBeenCalled();
    });
  });

  describe("a successful check-in", () => {
    it("writes it for the booked seat, builds on today's event check-in and answers who walked in", async () => {
      const { service, repo, tx } = setupAtDoor();

      const checkIn = await service.checkInToSession(
        eventId,
        sessionId,
        body,
        organizerActor,
      );

      expect(repo.insertSessionCheckIn).toHaveBeenCalledWith(tx, {
        sessionRegistrationId: heldBooking.id,
        eventCheckInId: eventCheckInRow.id,
        checkedInBy: organizerActor.id,
        at: AT_THE_DOOR,
      });
      expect(checkIn).toEqual({
        id: sessionCheckInRow.id,
        sessionId,
        checkedInAt: sessionCheckInRow.checkedInAt.toISOString(),
        method: "manual",
        attendee: {
          firstName: "Priya",
          lastName: "Shah",
          ticketCode: "ESEVT7K3Q9P",
        },
      });
    });

    it("finds the person by the code (upper-cased) in THIS event, then their seat in THIS session", async () => {
      const { service, repo, tx } = setupAtDoor();

      await service.checkInToSession(eventId, sessionId, body, organizerActor);

      expect(repo.lockEvent).toHaveBeenCalledWith(tx, eventId);
      expect(repo.findSessionForBooking).toHaveBeenCalledWith(
        tx,
        eventId,
        sessionId,
      );
      expect(repo.findRegistrationByTicketCode).toHaveBeenCalledWith(
        tx,
        eventId,
        "ESEVT7K3Q9P",
      );
      expect(repo.findSessionBooking).toHaveBeenCalledWith(
        tx,
        sessionId,
        ticketHolder.registration.userId,
      );
    });

    it("looks for the event check-in of today in the event's time zone", async () => {
      const { service, repo, tx } = setupAtDoor();

      await service.checkInToSession(eventId, sessionId, body, organizerActor);

      // 04:30 UTC is 10:00 on 12 December in Asia/Kolkata.
      expect(repo.findEventCheckIn).toHaveBeenCalledWith(
        tx,
        ticketHolder.registration.id,
        "2026-12-12",
      );
    });

    it("needs the event check-in of the event day the session belongs to (a late-night session of a long day)", async () => {
      // 18:30 UTC on the 12th is 00:00 on the 13th in Asia/Kolkata. The event runs from 09:30 on
      // the 12th until 03:30 on the 13th: ONE day that goes past midnight, so this session is part
      // of day 1, the day the person came through the event door that evening.
      // By calendar date it would be the 13th, and the door would wrongly say "check them in at the
      // event door first".
      const lateStart = new Date("2026-12-12T18:30:00.000Z");
      const lateEnd = new Date("2026-12-12T21:00:00.000Z");
      const { service, repo } = setupAtDoor(
        new Date("2026-12-12T19:00:00.000Z"),
      );
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        endAt: new Date("2026-12-12T22:00:00.000Z"),
      });
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        startAt: lateStart,
        endAt: lateEnd,
      });

      await service.checkInToSession(eventId, sessionId, body, organizerActor);

      expect(repo.findEventCheckIn).toHaveBeenCalledWith(
        expect.anything(),
        ticketHolder.registration.id,
        "2026-12-12",
      );
    });

    it("needs the check-in of day 2 for a session on day 2", async () => {
      // A two-day event (12–13 Dec, 09:30 IST each day); a session on 13 Dec at 11:00 IST.
      const { service, repo } = setupAtDoor(
        new Date("2026-12-13T05:00:00.000Z"),
      );
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        endAt: new Date("2026-12-13T12:00:00.000Z"),
      });
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        startAt: new Date("2026-12-13T05:30:00.000Z"),
        endAt: new Date("2026-12-13T06:30:00.000Z"),
      });

      await service.checkInToSession(eventId, sessionId, body, organizerActor);

      expect(repo.findEventCheckIn).toHaveBeenCalledWith(
        expect.anything(),
        ticketHolder.registration.id,
        "2026-12-13",
      );
    });

    it("matches the response schema and carries no email or user id", async () => {
      const { service } = setupAtDoor();

      const checkIn = await service.checkInToSession(
        eventId,
        sessionId,
        body,
        organizerActor,
      );

      expect(() => sessionCheckInResponseSchema.parse(checkIn)).not.toThrow();
      expect(Object.keys(checkIn).sort()).toEqual([
        "attendee",
        "checkedInAt",
        "id",
        "method",
        "sessionId",
      ]);
      expect(Object.keys(checkIn.attendee).sort()).toEqual([
        "firstName",
        "lastName",
        "ticketCode",
      ]);
    });
  });

  describe("who is at the door", () => {
    it("answers 404 for a code that holds no ticket in this event, and writes nothing", async () => {
      const { service, repo } = setupAtDoor();
      repo.findRegistrationByTicketCode.mockResolvedValue(null);

      await expect(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.findSessionBooking).not.toHaveBeenCalled();
      expect(repo.insertSessionCheckIn).not.toHaveBeenCalled();
    });

    it("answers 409 SESSION_NOT_BOOKED for a person with no seat, and names them", async () => {
      const { service, repo } = setupAtDoor();
      repo.findSessionBooking.mockResolvedValue(null);

      const failure = await service
        .checkInToSession(eventId, sessionId, body, organizerActor)
        .catch((e) => e);

      expect(failure).toMatchObject({
        status: 409,
        code: "SESSION_NOT_BOOKED",
        message: "Priya Shah has no seat booked in this session",
      });
      expect(repo.findEventCheckIn).not.toHaveBeenCalled();
      expect(repo.insertSessionCheckIn).not.toHaveBeenCalled();
    });

    it("answers 409 SESSION_NOT_BOOKED for a person who cancelled their seat (or whose ticket was cancelled)", async () => {
      const { service, repo } = setupAtDoor();
      repo.findSessionBooking.mockResolvedValue(cancelledBooking);

      await expectRefused(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
        "SESSION_NOT_BOOKED",
        repo.insertSessionCheckIn,
      );
    });

    it("answers 409 EVENT_CHECK_IN_REQUIRED for a person who has not come through the event door today", async () => {
      const { service, repo } = setupAtDoor();
      repo.findEventCheckIn.mockResolvedValue(null);

      const failure = await service
        .checkInToSession(eventId, sessionId, body, organizerActor)
        .catch((e) => e);

      expect(failure).toMatchObject({
        status: 409,
        code: "EVENT_CHECK_IN_REQUIRED",
      });
      expect(failure.message).toContain("Priya Shah");
      expect(repo.insertSessionCheckIn).not.toHaveBeenCalled();
    });

    it("answers 409 ALREADY_CHECKED_IN with who it is and when the seat was first used", async () => {
      const { service, repo } = setupAtDoor();
      repo.insertSessionCheckIn.mockResolvedValue(null);

      await expect(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
      ).rejects.toMatchObject({
        status: 409,
        code: "ALREADY_CHECKED_IN",
        message: "Priya Shah is already checked in to this session",
        details: {
          attendee: {
            firstName: "Priya",
            lastName: "Shah",
            ticketCode: "ESEVT7K3Q9P",
          },
          checkedInAt: "2026-12-12T04:30:00.000Z",
        },
      });
      expect(repo.findSessionCheckIn).toHaveBeenCalledWith(
        expect.anything(),
        heldBooking.id,
      );
    });

    it("still answers ALREADY_CHECKED_IN (with no details) if the first check-in cannot be read", async () => {
      const { service, repo } = setupAtDoor();
      repo.insertSessionCheckIn.mockResolvedValue(null);
      repo.findSessionCheckIn.mockResolvedValue(null);

      const failure = await service
        .checkInToSession(eventId, sessionId, body, organizerActor)
        .catch((error: unknown) => error);

      expect(failure).toMatchObject({
        code: "ALREADY_CHECKED_IN",
        details: {},
      });
    });
  });

  describe("the event", () => {
    it("answers 404 for an event that does not exist", async () => {
      const { service, repo } = setupAtDoor();
      repo.lockEvent.mockResolvedValue(null);

      await expect(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.findSessionForBooking).not.toHaveBeenCalled();
    });

    it("answers 409 EVENT_NOT_PUBLISHED for a draft event", async () => {
      const { service, repo } = setupAtDoor();
      repo.lockEvent.mockResolvedValue({ ...publishedEvent, status: "draft" });

      await expectRefused(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
        "EVENT_NOT_PUBLISHED",
        repo.insertSessionCheckIn,
      );
    });

    it("answers 409 EVENT_CANCELLED for a cancelled event", async () => {
      const { service, repo } = setupAtDoor();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        status: "cancelled",
      });

      await expectRefused(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
        "EVENT_CANCELLED",
        repo.insertSessionCheckIn,
      );
    });
  });

  describe("the session", () => {
    it("answers 404 for a session that is not in this event", async () => {
      const { service, repo } = setupAtDoor();
      repo.findSessionForBooking.mockResolvedValue(null);

      await expect(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.findRegistrationByTicketCode).not.toHaveBeenCalled();
    });

    it("answers 404 for a draft session, as if it did not exist", async () => {
      const { service, repo } = setupAtDoor();
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        status: "draft",
      });

      await expect(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("answers 409 SESSION_CANCELLED for a cancelled session", async () => {
      const { service, repo } = setupAtDoor();
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        status: "cancelled",
      });

      await expectRefused(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
        "SESSION_CANCELLED",
        repo.insertSessionCheckIn,
      );
    });
  });

  describe("the session's check-in window", () => {
    it("is open exactly 2 hours before the session starts (the production default)", async () => {
      const { service } = setupAtDoor(new Date(startAt.getTime() - 2 * HOUR));

      await expect(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
      ).resolves.toMatchObject({ sessionId });
    });

    it("answers 409 CHECK_IN_NOT_OPEN a second before that, and says how early it opens", async () => {
      const { service, repo } = setupAtDoor(
        new Date(startAt.getTime() - 2 * HOUR - 1000),
      );

      const failure = await service
        .checkInToSession(eventId, sessionId, body, organizerActor)
        .catch((e) => e);

      expect(failure).toMatchObject({
        status: 409,
        code: "CHECK_IN_NOT_OPEN",
        message: "Session check-in opens 2 hours before the session starts",
      });
      expect(repo.insertSessionCheckIn).not.toHaveBeenCalled();
    });

    it("stays open while the session is running", async () => {
      const { service } = setupAtDoor(new Date(startAt.getTime() + HOUR));

      await expect(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
      ).resolves.toMatchObject({ sessionId });
    });

    it("answers 409 CHECK_IN_CLOSED at the moment the session ends", async () => {
      const { service, repo } = setupAtDoor(endAt);

      await expectRefused(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
        "CHECK_IN_CLOSED",
        repo.insertSessionCheckIn,
      );
    });

    it("is open until the very last second", async () => {
      const { service } = setupAtDoor(new Date(endAt.getTime() - 1000));

      await expect(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
      ).resolves.toMatchObject({ sessionId });
    });

    it("follows the setting: a window of 1 hour says so in singular", async () => {
      const { service } = setupAtDoor(
        new Date(startAt.getTime() - 90 * 60000),
        {
          sessionCheckInOpensHoursBefore: 1,
        },
      );

      await expect(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
      ).rejects.toMatchObject({
        code: "CHECK_IN_NOT_OPEN",
        message: "Session check-in opens 1 hour before the session starts",
      });
    });

    it("opens a long time ahead when the setting says so (the next dev default: a year)", async () => {
      const { service } = setupAtDoor(
        new Date(startAt.getTime() - 30 * 24 * HOUR),
        { sessionCheckInOpensHoursBefore: 24 * 365 },
      );

      await expect(
        service.checkInToSession(eventId, sessionId, body, organizerActor),
      ).resolves.toMatchObject({ sessionId });
    });
  });
});

describe("sessionCheckInResponseSchema", () => {
  const valid = {
    id: sessionCheckInRow.id,
    sessionId,
    checkedInAt: "2026-12-12T04:30:00.000Z",
    method: "manual",
    attendee: {
      firstName: "Priya",
      lastName: "Shah",
      ticketCode: "ESEVT7K3Q9P",
    },
  };

  it("accepts a check-in", () => {
    expect(sessionCheckInResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a bad id, an unknown method and a date that is not ISO", () => {
    expect(
      sessionCheckInResponseSchema.safeParse({ ...valid, id: "nope" }).success,
    ).toBe(false);
    expect(
      sessionCheckInResponseSchema.safeParse({ ...valid, method: "telepathy" })
        .success,
    ).toBe(false);
    expect(
      sessionCheckInResponseSchema.safeParse({
        ...valid,
        checkedInAt: "yesterday",
      }).success,
    ).toBe(false);
  });
});
