import { PERMISSION } from "../../../../core/auth/permission-catalog";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../../core/http/errors";
import {
  adminActor,
  cancelledRegistration,
  eventCheckInRow,
  eventId,
  organizerActor,
  publishedEvent,
  setupRegistrationService,
  ticketHolder,
} from "../../__fixtures__/registration-service";
import {
  checkInBodySchema,
  checkInResponseSchema,
  eventCheckInBodySchema,
} from "../../schemas/check-ins.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const HOUR = 60 * 60 * 1000;

// 09:30 to 17:30 in Asia/Kolkata on 12 Dec 2026.
const START = new Date("2026-12-12T04:00:00.000Z");
const END = new Date("2026-12-12T12:00:00.000Z");
const event = { ...publishedEvent, startAt: START, endAt: END };

// The door sends the code and the event day it checks the person in for.
const body = { ticketCode: "ESEVT7K3Q9P", attendanceDate: "2026-12-12" };

/** The door at `at`: a published event that is on, and a ticket that belongs to it. */
function setupDoor(
  at: Date = new Date(START.getTime() + HOUR),
  options: { checkInOpensHoursBefore?: number } = {},
) {
  const ctx = setupRegistrationService(at, options);
  ctx.eventAccess.getEventIfOrgOwns.mockResolvedValue(event);
  ctx.repo.lockEvent.mockResolvedValue(event);
  ctx.repo.findRegistrationByTicketCode.mockResolvedValue(ticketHolder);
  return ctx;
}

describe("registrationService.checkInAttendee", () => {
  describe("checking in", () => {
    it("writes a manual check-in by the signed-in user for the event day", async () => {
      const at = new Date(START.getTime() + HOUR);
      const { service, repo, tx } = setupDoor(at);

      await service.checkInAttendee(eventId, body, organizerActor);

      expect(repo.findRegistrationByTicketCode).toHaveBeenCalledWith(
        tx,
        eventId,
        "ESEVT7K3Q9P",
      );
      expect(repo.insertEventCheckIn).toHaveBeenCalledWith(tx, {
        registrationId: ticketHolder.registration.id,
        attendanceDate: "2026-12-12",
        checkedInBy: organizerActor.id,
        at,
      });
    });

    it("answers who walked in, and nothing about their email or user id", async () => {
      const { service } = setupDoor();

      const result = await service.checkInAttendee(
        eventId,
        body,
        organizerActor,
      );

      expect(result).toEqual({
        id: eventCheckInRow.id,
        registrationId: eventCheckInRow.registrationId,
        attendanceDate: "2026-12-12",
        checkedInAt: "2026-12-12T03:30:00.000Z",
        method: "manual",
        attendee: {
          firstName: "Priya",
          lastName: "Shah",
          ticketCode: "ESEVT7K3Q9P",
        },
      });
      expect(() => checkInResponseSchema.parse(result)).not.toThrow();
      expect(result.attendee).not.toHaveProperty("email");
      expect(result).not.toHaveProperty("userId");
    });

    it("locks the event first and does everything in one transaction", async () => {
      const { service, repo, tx } = setupDoor();

      await service.checkInAttendee(eventId, body, organizerActor);

      expect(repo.transaction).toHaveBeenCalledTimes(1);
      expect(repo.lockEvent).toHaveBeenCalledWith(tx, eventId);
      const [lock] = repo.lockEvent.mock.invocationCallOrder;
      const [find] = repo.findRegistrationByTicketCode.mock.invocationCallOrder;
      const [insert] = repo.insertEventCheckIn.mock.invocationCallOrder;
      expect(lock).toBeLessThan(find);
      expect(find).toBeLessThan(insert);
    });

    it("lets an admin check people in at any event", async () => {
      const { service, repo } = setupDoor();

      await service.checkInAttendee(eventId, body, adminActor);

      expect(repo.insertEventCheckIn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ checkedInBy: adminActor.id }),
      );
    });
  });

  describe("the day sent by the door (attendanceDate)", () => {
    // A two-day event, 12 and 13 Dec, every day 09:30 → 17:30 IST. Day 1's check-in closes when
    // day 1's hours end: 12 Dec 17:30 IST (12:00 UTC). Day 2's opens 13 Dec 03:30 IST.
    const twoDays = { ...event, endAt: new Date("2026-12-13T12:00:00.000Z") };
    const DAY2_START = new Date("2026-12-13T04:00:00.000Z");
    const DAY1_END = new Date("2026-12-12T12:00:00.000Z");
    const day = (attendanceDate: string) => ({ ...body, attendanceDate });

    function twoDayDoor(
      at: Date,
      options: { checkInOpensHoursBefore?: number } = {},
    ) {
      const ctx = setupDoor(at, options);
      ctx.repo.lockEvent.mockResolvedValue(twoDays);
      return ctx;
    }

    it("saves the day that was sent, in the event's time zone (not UTC)", async () => {
      // 22:00 UTC on 11 Dec is already 03:30 on 12 Dec in Kolkata, and the door has just opened.
      const { service, repo } = setupDoor(new Date(START.getTime() - 6 * HOUR));

      await service.checkInAttendee(eventId, body, organizerActor);

      expect(repo.insertEventCheckIn.mock.calls[0][1].attendanceDate).toBe(
        "2026-12-12",
      );
    });

    it.each(["2026-12-11", "2026-12-14", "2025-12-12"])(
      "refuses %s, not a day of the event, with 409 NOT_AN_EVENT_DAY, and looks nothing up",
      async (date) => {
        const { service, repo } = twoDayDoor(new Date(START.getTime() + HOUR));

        await expect(
          service.checkInAttendee(eventId, day(date), organizerActor),
        ).rejects.toMatchObject({
          status: 409,
          code: "NOT_AN_EVENT_DAY",
          message: `${date} is not a day of this event`,
        });
        expect(repo.findRegistrationByTicketCode).not.toHaveBeenCalled();
        expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
      },
    );

    it("checks in for day 2 during day 2", async () => {
      const { service, repo } = twoDayDoor(
        new Date(DAY2_START.getTime() + HOUR),
      );

      await service.checkInAttendee(eventId, day("2026-12-13"), organizerActor);

      expect(repo.insertEventCheckIn.mock.calls[0][1].attendanceDate).toBe(
        "2026-12-13",
      );
    });

    it("does not accept a future day in production: day 2 during day 1 is CHECK_IN_NOT_OPEN", async () => {
      const { service, repo } = twoDayDoor(new Date(START.getTime() + HOUR));

      await expect(
        service.checkInAttendee(eventId, day("2026-12-13"), organizerActor),
      ).rejects.toMatchObject({
        code: "CHECK_IN_NOT_OPEN",
        message: "Check-in for 2026-12-13 opens 6 hours before that day starts",
      });
      expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
    });

    it("lets a late arrival in until day 1's hours end", async () => {
      // 12 Dec 17:29 IST: day 1 is still running.
      const { service, repo } = twoDayDoor(
        new Date(DAY1_END.getTime() - 60 * 1000),
      );

      await service.checkInAttendee(eventId, day("2026-12-12"), organizerActor);

      expect(repo.insertEventCheckIn.mock.calls[0][1].attendanceDate).toBe(
        "2026-12-12",
      );
    });

    it("closes day 1 when its hours end: a past day is refused with CHECK_IN_CLOSED", async () => {
      const { service, repo } = twoDayDoor(DAY1_END);

      await expect(
        service.checkInAttendee(eventId, day("2026-12-12"), organizerActor),
      ).rejects.toMatchObject({
        code: "CHECK_IN_CLOSED",
        message: "Check-in for 2026-12-12 is over",
      });
      expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
    });

    it("keeps the running day open when the next day's door has already opened", async () => {
      // Every day 08:00 → 04:00 the next morning, so day 2's door (02:00) opens before day 1
      // ends (04:00). At 13 Dec 03:00 IST a late arrival still gets day 1, and day 2 is open too.
      const longDays = {
        ...event,
        startAt: new Date("2026-12-12T02:30:00.000Z"),
        endAt: new Date("2026-12-13T22:30:00.000Z"),
      };
      const at = new Date("2026-12-12T21:30:00.000Z");

      const late = setupDoor(at);
      late.repo.lockEvent.mockResolvedValue(longDays);
      await late.service.checkInAttendee(
        eventId,
        day("2026-12-12"),
        organizerActor,
      );
      expect(late.repo.insertEventCheckIn.mock.calls[0][1].attendanceDate).toBe(
        "2026-12-12",
      );

      const early = setupDoor(at);
      early.repo.lockEvent.mockResolvedValue(longDays);
      await early.service.checkInAttendee(
        eventId,
        day("2026-12-13"),
        organizerActor,
      );
      expect(early.repo.insertEventCheckIn).toHaveBeenCalledTimes(1);
    });

    it("with a year-wide window (dev), accepts a future day early, but still refuses a past one", async () => {
      // Day 1 is running: dev can try day 2 already...
      const early = twoDayDoor(new Date(START.getTime() + HOUR), {
        checkInOpensHoursBefore: 24 * 365,
      });
      await early.service.checkInAttendee(
        eventId,
        day("2026-12-13"),
        organizerActor,
      );
      expect(early.repo.insertEventCheckIn).toHaveBeenCalledTimes(1);

      // ...but once day 1's check-in has closed, day 1 is refused in dev too.
      const late = twoDayDoor(DAY1_END, { checkInOpensHoursBefore: 24 * 365 });
      await expect(
        late.service.checkInAttendee(
          eventId,
          day("2026-12-12"),
          organizerActor,
        ),
      ).rejects.toMatchObject({ code: "CHECK_IN_CLOSED" });
    });

    it("handles days that start very early: a 01:00 day opens at 19:00 the evening before", async () => {
      // 12 Dec 01:00 IST (11 Dec 19:30 UTC) to 13 Dec 18:00 IST; day 2 opens 12 Dec 19:00 IST.
      const earlyDays = {
        ...event,
        startAt: new Date("2026-12-11T19:30:00.000Z"),
        endAt: new Date("2026-12-13T12:30:00.000Z"),
      };
      // 12 Dec 20:00 IST: someone arrives for day 2 the evening before.
      const { service, repo } = setupDoor(new Date("2026-12-12T14:30:00.000Z"));
      repo.lockEvent.mockResolvedValue(earlyDays);

      await service.checkInAttendee(eventId, day("2026-12-13"), organizerActor);

      expect(repo.insertEventCheckIn.mock.calls[0][1].attendanceDate).toBe(
        "2026-12-13",
      );
    });
  });

  describe("who may check in", () => {
    it("answers 403 to a role with neither permission, and reads nothing", async () => {
      const { service, repo, eventAccess } = setupDoor();
      const attendee = {
        ...organizerActor,
        role: "user" as const,
        permissions: new Set([
          PERMISSION.REGISTRATION_CREATE,
          PERMISSION.REGISTRATION_VIEW_OWN,
        ]),
      };

      await expect(
        service.checkInAttendee(eventId, body, attendee),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(eventAccess.getEventIfOrgOwns).not.toHaveBeenCalled();
      expect(repo.transaction).not.toHaveBeenCalled();
    });

    it("does not let an organizer who may only view attendees check anyone in", async () => {
      const { service, repo } = setupDoor();
      const viewer = {
        ...organizerActor,
        permissions: new Set([
          PERMISSION.EVENT_MANAGE_OWN,
          PERMISSION.REGISTRATION_VIEW_EVENT,
        ]),
      };

      await expect(
        service.checkInAttendee(eventId, body, viewer),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
    });

    it("answers 404 for an event the organizer does not own, and writes nothing", async () => {
      const { service, repo, eventAccess } = setupDoor();
      eventAccess.getEventIfOrgOwns.mockRejectedValue(
        new NotFoundError("Event not found"),
      );

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.transaction).not.toHaveBeenCalled();
      expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
    });

    it("passes on the error when the organizer is not approved, and writes nothing", async () => {
      const { service, repo, eventAccess } = setupDoor();
      const refusal = new ForbiddenError();
      eventAccess.getEventIfOrgOwns.mockRejectedValue(refusal);

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toBe(refusal);
      expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
    });

    it("answers 404 when the event is gone by the time it is locked", async () => {
      const { service, repo } = setupDoor();
      repo.lockEvent.mockResolvedValue(null);

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
    });
  });

  describe("the event", () => {
    it("refuses a draft with 409 EVENT_NOT_PUBLISHED", async () => {
      const { service, repo } = setupDoor();
      repo.lockEvent.mockResolvedValue({ ...event, status: "draft" });

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toMatchObject({ status: 409, code: "EVENT_NOT_PUBLISHED" });
      expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
    });

    it("refuses a cancelled event with 409 EVENT_CANCELLED", async () => {
      const { service, repo } = setupDoor();
      repo.lockEvent.mockResolvedValue({ ...event, status: "cancelled" });

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toMatchObject({ status: 409, code: "EVENT_CANCELLED" });
    });
  });

  describe("the check-in window: 6 hours before the start until the end", () => {
    it("opens exactly 6 hours before the event starts", async () => {
      const { service, repo } = setupDoor(new Date(START.getTime() - 6 * HOUR));

      await service.checkInAttendee(eventId, body, organizerActor);

      expect(repo.insertEventCheckIn).toHaveBeenCalledTimes(1);
    });

    it("is not open a moment earlier: 409 CHECK_IN_NOT_OPEN, and nothing is looked up", async () => {
      const { service, repo } = setupDoor(
        new Date(START.getTime() - 6 * HOUR - 1),
      );

      const failure = await service
        .checkInAttendee(eventId, body, organizerActor)
        .catch((error) => error);

      expect(failure).toBeInstanceOf(ConflictError);
      expect(failure).toMatchObject({
        status: 409,
        code: "CHECK_IN_NOT_OPEN",
        message: "Check-in for 2026-12-12 opens 6 hours before that day starts",
      });
      expect(repo.findRegistrationByTicketCode).not.toHaveBeenCalled();
      expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
    });

    it("is still open a moment before the end", async () => {
      const { service, repo } = setupDoor(new Date(END.getTime() - 1));

      await service.checkInAttendee(eventId, body, organizerActor);

      expect(repo.insertEventCheckIn).toHaveBeenCalledTimes(1);
    });

    it("is closed at the end: 409 CHECK_IN_CLOSED", async () => {
      const { service, repo } = setupDoor(END);

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toMatchObject({ status: 409, code: "CHECK_IN_CLOSED" });
      expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
    });
  });

  describe("when the setting opens the door earlier (CHECK_IN_OPENS_HOURS_BEFORE)", () => {
    it("opens that many hours before the start, to the moment", async () => {
      const { service, repo } = setupDoor(
        new Date(START.getTime() - 24 * HOUR),
        { checkInOpensHoursBefore: 24 },
      );

      await service.checkInAttendee(eventId, body, organizerActor);

      expect(repo.insertEventCheckIn).toHaveBeenCalledTimes(1);
    });

    it("is not open a moment earlier, and the message says the configured hours", async () => {
      const { service } = setupDoor(new Date(START.getTime() - 24 * HOUR - 1), {
        checkInOpensHoursBefore: 24,
      });

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toMatchObject({
        code: "CHECK_IN_NOT_OPEN",
        message:
          "Check-in for 2026-12-12 opens 24 hours before that day starts",
      });
    });

    it("says 1 hour, not 1 hours", async () => {
      const { service } = setupDoor(new Date(START.getTime() - 2 * HOUR), {
        checkInOpensHoursBefore: 1,
      });

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toMatchObject({
        message: "Check-in for 2026-12-12 opens 1 hour before that day starts",
      });
    });

    it("still closes at the end of the event, whatever the setting", async () => {
      const { service } = setupDoor(END, { checkInOpensHoursBefore: 24 * 365 });

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toMatchObject({ code: "CHECK_IN_CLOSED" });
    });

    it("lets a year-wide window check in an event that is weeks away", async () => {
      // The dev default: an event on 1 Dec, tested on 19 Nov.
      const weeksAway = new Date("2026-11-19T10:00:00.000Z");
      const { service, repo } = setupDoor(weeksAway, {
        checkInOpensHoursBefore: 24 * 365,
      });

      await service.checkInAttendee(eventId, body, organizerActor);

      expect(repo.insertEventCheckIn).toHaveBeenCalledTimes(1);
    });
  });

  describe("the ticket", () => {
    it("answers 404 for a code that holds no ticket in this event (also another event's code)", async () => {
      const { service, repo } = setupDoor();
      repo.findRegistrationByTicketCode.mockResolvedValue(null);

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
    });

    it("refuses a cancelled ticket with 409 REGISTRATION_CANCELLED", async () => {
      const { service, repo } = setupDoor();
      repo.findRegistrationByTicketCode.mockResolvedValue({
        ...ticketHolder,
        registration: cancelledRegistration,
      });

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toMatchObject({ status: 409, code: "REGISTRATION_CANCELLED" });
      expect(repo.insertEventCheckIn).not.toHaveBeenCalled();
    });

    it("refuses a repeat on the same day with 409 ALREADY_CHECKED_IN, naming the person", async () => {
      const { service, repo } = setupDoor();
      repo.insertEventCheckIn.mockResolvedValue(null);

      const failure = await service
        .checkInAttendee(eventId, body, organizerActor)
        .catch((error) => error);

      expect(failure).toBeInstanceOf(ConflictError);
      expect(failure).toMatchObject({
        status: 409,
        code: "ALREADY_CHECKED_IN",
        message: "Priya Shah is already checked in today",
        // Who, and when they were first let in that day: the door shows both.
        details: {
          attendee: {
            firstName: "Priya",
            lastName: "Shah",
            ticketCode: "ESEVT7K3Q9P",
          },
          checkedInAt: "2026-12-12T03:30:00.000Z",
        },
      });
      expect(repo.findEventCheckIn).toHaveBeenCalledWith(
        expect.anything(),
        ticketHolder.registration.id,
        "2026-12-12",
      );
    });
  });
});

describe("checkInBodySchema", () => {
  it("accepts a ticket code and makes it upper case, trimmed", () => {
    expect(
      checkInBodySchema.parse({ ticketCode: "  esevt7k3q9p " }).ticketCode,
    ).toBe("ESEVT7K3Q9P");
  });

  it("rejects a missing, blank or over-long code", () => {
    expect(checkInBodySchema.safeParse({}).success).toBe(false);
    expect(checkInBodySchema.safeParse({ ticketCode: "   " }).success).toBe(
      false,
    );
    expect(
      checkInBodySchema.safeParse({ ticketCode: "X".repeat(33) }).success,
    ).toBe(false);
  });

  it("has no user, event or method field: unknown keys are dropped", () => {
    const parsed = checkInBodySchema.parse({
      ticketCode: "ESEVT7K3Q9P",
      userId: "someone",
      method: "qr_scan",
      eventId: "other",
    });
    expect(Object.keys(parsed)).toEqual(["ticketCode"]);
  });
});

describe("eventCheckInBodySchema (the event door)", () => {
  it("needs the event day as well as the code", () => {
    expect(
      eventCheckInBodySchema.parse({
        ticketCode: " esevt7k3q9p ",
        attendanceDate: "2026-12-12",
      }),
    ).toEqual({ ticketCode: "ESEVT7K3Q9P", attendanceDate: "2026-12-12" });
  });

  it.each([
    { reason: "missing", attendanceDate: undefined },
    { reason: "not YYYY-MM-DD", attendanceDate: "12/12/2026" },
    { reason: "not a real date", attendanceDate: "2026-02-30" },
    { reason: "a time, not a day", attendanceDate: "2026-12-12T09:00:00Z" },
  ])("rejects a day that is $reason", ({ attendanceDate }) => {
    expect(
      eventCheckInBodySchema.safeParse({
        ticketCode: "ESEVT7K3Q9P",
        attendanceDate,
      }).success,
    ).toBe(false);
  });
});
