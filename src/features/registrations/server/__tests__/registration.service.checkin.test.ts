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
} from "../../schemas/check-ins.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const HOUR = 60 * 60 * 1000;

// 09:30 to 17:30 in Asia/Kolkata on 12 Dec 2026.
const START = new Date("2026-12-12T04:00:00.000Z");
const END = new Date("2026-12-12T12:00:00.000Z");
const event = { ...publishedEvent, startAt: START, endAt: END };

const body = { ticketCode: "ESEVT7K3Q9P" };

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

  describe("the event day", () => {
    it("is the day in the event's time zone, not in UTC", async () => {
      // 22:00 UTC on 11 Dec is already 03:30 on 12 Dec in Kolkata, and the door has just opened.
      const at = new Date(START.getTime() - 6 * HOUR);
      const { service, repo } = setupDoor(at);

      await service.checkInAttendee(eventId, body, organizerActor);

      expect(repo.insertEventCheckIn.mock.calls[0][1].attendanceDate).toBe(
        "2026-12-12",
      );
    });

    it("moves to the next day for the second day of a two-day event", async () => {
      // 20:00 UTC on 12 Dec is 01:30 on 13 Dec in Kolkata.
      const at = new Date("2026-12-12T20:00:00.000Z");
      const twoDays = { ...event, endAt: new Date("2026-12-13T12:00:00.000Z") };
      const { service, repo } = setupDoor(at);
      repo.lockEvent.mockResolvedValue(twoDays);

      await service.checkInAttendee(eventId, body, organizerActor);

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
        message: "Check-in opens 6 hours before the event starts",
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
        message: "Check-in opens 24 hours before the event starts",
      });
    });

    it("says 1 hour, not 1 hours", async () => {
      const { service } = setupDoor(new Date(START.getTime() - 2 * HOUR), {
        checkInOpensHoursBefore: 1,
      });

      await expect(
        service.checkInAttendee(eventId, body, organizerActor),
      ).rejects.toMatchObject({
        message: "Check-in opens 1 hour before the event starts",
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
      });
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
