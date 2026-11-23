import { ConflictError, NotFoundError } from "../../../../core/http/errors";
import {
  actor,
  bookableSession,
  cancelledBooking,
  eventId,
  heldBooking,
  NOW,
  publishedEvent,
  sessionId,
  setupRegistrationService,
  userId,
} from "../../__fixtures__/registration-service";
import { sessionBookingResponseSchema } from "../../schemas/registrations.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const HOUR = 60 * 60 * 1000;

/** The service of a user who holds a booking, the normal way to cancel. */
function setupBooked(now: Date = NOW) {
  const setup = setupRegistrationService(now);
  setup.repo.findSessionBooking.mockResolvedValue(heldBooking);
  return setup;
}

/** The cancel was refused: a 409 with this code, and nothing was written. */
async function expectRefused(
  attempt: Promise<unknown>,
  code: string,
  cancel: jest.Mock,
) {
  const failure = await attempt.catch((e) => e);
  expect(failure).toBeInstanceOf(ConflictError);
  expect(failure).toMatchObject({ status: 409, code });
  expect(cancel).not.toHaveBeenCalled();
}

describe("registrationService.cancelSessionBooking", () => {
  describe("cancelling a seat", () => {
    it("cancels the user's own booking and answers it as cancelled", async () => {
      const { service, repo, tx } = setupBooked();

      const booking = await service.cancelSessionBooking(
        eventId,
        sessionId,
        actor,
      );

      expect(repo.findSessionBooking).toHaveBeenCalledWith(
        tx,
        sessionId,
        userId,
      );
      expect(repo.cancelSessionBooking).toHaveBeenCalledWith(
        tx,
        heldBooking.id,
        NOW,
      );
      expect(booking).toEqual({
        id: heldBooking.id,
        sessionId,
        status: "cancelled",
        registeredAt: heldBooking.registeredAt.toISOString(),
      });
    });

    it("looks the session up in THIS event, under the event lock", async () => {
      const { service, repo, tx } = setupBooked();

      await service.cancelSessionBooking(eventId, sessionId, actor);

      expect(repo.lockEvent).toHaveBeenCalledWith(tx, eventId);
      expect(repo.findSessionForBooking).toHaveBeenCalledWith(
        tx,
        eventId,
        sessionId,
      );
    });

    it("matches the response schema and carries no user id", async () => {
      const { service } = setupBooked();

      const booking = await service.cancelSessionBooking(
        eventId,
        sessionId,
        actor,
      );

      expect(() => sessionBookingResponseSchema.parse(booking)).not.toThrow();
      expect(Object.keys(booking).sort()).toEqual([
        "id",
        "registeredAt",
        "sessionId",
        "status",
      ]);
    });

    it("lets the user cancel a seat in a cancelled session", async () => {
      const { service, repo } = setupBooked();
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        status: "cancelled",
      });

      await expect(
        service.cancelSessionBooking(eventId, sessionId, actor),
      ).resolves.toMatchObject({ status: "cancelled" });
    });
  });

  describe("cancelling twice", () => {
    it("answers the cancelled booking again and writes nothing", async () => {
      const { service, repo } = setupRegistrationService();
      repo.findSessionBooking.mockResolvedValue(cancelledBooking);

      await expect(
        service.cancelSessionBooking(eventId, sessionId, actor),
      ).resolves.toMatchObject({ id: heldBooking.id, status: "cancelled" });
      expect(repo.cancelSessionBooking).not.toHaveBeenCalled();
    });

    it("still answers it after registration has closed", async () => {
      const { service, repo } = setupRegistrationService(
        new Date(publishedEvent.startAt.getTime() + HOUR),
      );
      repo.findSessionBooking.mockResolvedValue(cancelledBooking);

      await expect(
        service.cancelSessionBooking(eventId, sessionId, actor),
      ).resolves.toMatchObject({ status: "cancelled" });
    });
  });

  describe("not found", () => {
    it("answers 404 for an event that does not exist", async () => {
      const { service, repo } = setupBooked();
      repo.lockEvent.mockResolvedValue(null);

      await expect(
        service.cancelSessionBooking(eventId, sessionId, actor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.findSessionForBooking).not.toHaveBeenCalled();
    });

    it("answers 404 for a session that is not in this event", async () => {
      const { service, repo } = setupBooked();
      repo.findSessionForBooking.mockResolvedValue(null);

      await expect(
        service.cancelSessionBooking(eventId, sessionId, actor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.findSessionBooking).not.toHaveBeenCalled();
      expect(repo.cancelSessionBooking).not.toHaveBeenCalled();
    });

    it("answers 404 when the user never booked the session", async () => {
      const { service, repo } = setupRegistrationService();
      repo.findSessionBooking.mockResolvedValue(null);

      await expect(
        service.cancelSessionBooking(eventId, sessionId, actor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.cancelSessionBooking).not.toHaveBeenCalled();
    });
  });

  describe("until registration closes", () => {
    it("is open before the closing time that was set", async () => {
      const closesAt = new Date(NOW.getTime() + HOUR);
      const { service, repo } = setupBooked();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        registrationClosesAt: closesAt,
      });

      await expect(
        service.cancelSessionBooking(eventId, sessionId, actor),
      ).resolves.toMatchObject({ status: "cancelled" });
    });

    it("answers 409 CANCELLATION_CLOSED once the set closing time has passed", async () => {
      const { service, repo } = setupBooked();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        registrationClosesAt: new Date(NOW.getTime() - HOUR),
      });

      await expectRefused(
        service.cancelSessionBooking(eventId, sessionId, actor),
        "CANCELLATION_CLOSED",
        repo.cancelSessionBooking,
      );
    });

    it("answers 409 CANCELLATION_CLOSED at the very moment it closes", async () => {
      const { service, repo } = setupBooked();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        registrationClosesAt: NOW,
      });

      await expectRefused(
        service.cancelSessionBooking(eventId, sessionId, actor),
        "CANCELLATION_CLOSED",
        repo.cancelSessionBooking,
      );
    });

    it("closes when the event starts if no closing time was set", async () => {
      const { service, repo } = setupBooked(publishedEvent.startAt);

      await expectRefused(
        service.cancelSessionBooking(eventId, sessionId, actor),
        "CANCELLATION_CLOSED",
        repo.cancelSessionBooking,
      );
    });

    it("is open until the event starts if no closing time was set", async () => {
      const { service } = setupBooked(
        new Date(publishedEvent.startAt.getTime() - 1000),
      );

      await expect(
        service.cancelSessionBooking(eventId, sessionId, actor),
      ).resolves.toMatchObject({ status: "cancelled" });
    });
  });

  describe("after a check-in", () => {
    it("answers 409 ALREADY_CHECKED_IN for a seat that was used", async () => {
      const { service, repo, tx } = setupBooked();
      repo.hasSessionCheckIn.mockResolvedValue(true);

      await expectRefused(
        service.cancelSessionBooking(eventId, sessionId, actor),
        "ALREADY_CHECKED_IN",
        repo.cancelSessionBooking,
      );
      expect(repo.hasSessionCheckIn).toHaveBeenCalledWith(tx, heldBooking.id);
    });
  });

  describe("a booking that changed meanwhile", () => {
    it("answers 409 BOOKING_CHANGED when the update finds it no longer registered", async () => {
      const { service, repo } = setupBooked();
      repo.cancelSessionBooking.mockResolvedValue(null);

      await expect(
        service.cancelSessionBooking(eventId, sessionId, actor),
      ).rejects.toMatchObject({ status: 409, code: "BOOKING_CHANGED" });
    });
  });
});
