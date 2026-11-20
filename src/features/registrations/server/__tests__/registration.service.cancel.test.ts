import { ConflictError, NotFoundError } from "../../../../core/http/errors";
import {
  actor,
  cancelledRegistration,
  eventId,
  heldRegistration,
  NOW,
  publishedEvent,
  setupRegistrationService,
  userId,
} from "../../__fixtures__/registration-service";
import { myRegistrationResponseSchema } from "../../schemas/registrations.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const HOUR = 60 * 60 * 1000;

/** A user who holds a registration: the one cancel works on. */
function setupHolder() {
  const ctx = setupRegistrationService();
  ctx.repo.findRegistration.mockResolvedValue(heldRegistration);
  return ctx;
}

describe("registrationService.cancelMyRegistration", () => {
  describe("cancelling", () => {
    it("cancels the user's registration and answers it as cancelled, with no sessions left", async () => {
      const { service, repo, tx } = setupHolder();

      const result = await service.cancelMyRegistration(eventId, actor);

      expect(repo.findRegistration).toHaveBeenCalledWith(tx, eventId, userId);
      expect(repo.cancelRegistration).toHaveBeenCalledWith(
        tx,
        heldRegistration.id,
        NOW,
      );
      expect(result.registration).toMatchObject({
        eventId,
        status: "cancelled",
        amount: 0,
        currency: "INR",
        reason: "free",
      });
      expect(result.bookedSessionIds).toEqual([]);
    });

    it("cancels the user's seats in the event's sessions too", async () => {
      const { service, repo, tx } = setupHolder();

      await service.cancelMyRegistration(eventId, actor);

      expect(repo.cancelSessionBookings).toHaveBeenCalledWith(
        tx,
        eventId,
        userId,
        NOW,
      );
    });

    it("locks the event first and does everything in one transaction", async () => {
      const { service, repo, tx } = setupHolder();

      await service.cancelMyRegistration(eventId, actor);

      expect(repo.transaction).toHaveBeenCalledTimes(1);
      expect(repo.lockEvent).toHaveBeenCalledWith(tx, eventId);
      const [lock] = repo.lockEvent.mock.invocationCallOrder;
      const [cancel] = repo.cancelRegistration.mock.invocationCallOrder;
      const [bookings] = repo.cancelSessionBookings.mock.invocationCallOrder;
      expect(lock).toBeLessThan(cancel);
      expect(cancel).toBeLessThan(bookings);
    });

    it("answers a body that matches the response schema and hides the user and internal dates", async () => {
      const { service } = setupHolder();

      const result = await service.cancelMyRegistration(eventId, actor);

      expect(() => myRegistrationResponseSchema.parse(result)).not.toThrow();
      expect(result.registration).not.toHaveProperty("userId");
      expect(result.registration).not.toHaveProperty("cancelledAt");
      expect(result.registration).not.toHaveProperty("updatedAt");
    });

    it("shows a cancelled ticket on a paid event as complimentary: there is nothing to refund", async () => {
      const { service, repo } = setupHolder();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        ticketPrice: 150_000,
      });

      const result = await service.cancelMyRegistration(eventId, actor);

      expect(result.registration).toMatchObject({
        status: "cancelled",
        amount: 0,
        reason: "complimentary_speaker",
      });
    });
  });

  describe("who can cancel what", () => {
    it("answers 404 when the user has no registration, and writes nothing", async () => {
      const { service, repo } = setupRegistrationService();

      await expect(
        service.cancelMyRegistration(eventId, actor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.cancelRegistration).not.toHaveBeenCalled();
      expect(repo.cancelSessionBookings).not.toHaveBeenCalled();
    });

    it("answers 404 for an event that does not exist", async () => {
      const { service, repo } = setupHolder();
      repo.lockEvent.mockResolvedValue(null);

      await expect(
        service.cancelMyRegistration(eventId, actor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.cancelRegistration).not.toHaveBeenCalled();
    });

    it("only ever looks at the signed-in user's registration", async () => {
      const { service, repo, tx } = setupHolder();

      await service.cancelMyRegistration(eventId, actor);

      expect(repo.findRegistration).toHaveBeenCalledTimes(1);
      expect(repo.findRegistration).toHaveBeenCalledWith(tx, eventId, userId);
    });
  });

  describe("cancelling twice", () => {
    it("answers the cancelled registration again and writes nothing", async () => {
      const { service, repo } = setupRegistrationService();
      repo.findRegistration.mockResolvedValue(cancelledRegistration);

      const result = await service.cancelMyRegistration(eventId, actor);

      expect(result.registration?.status).toBe("cancelled");
      expect(result.bookedSessionIds).toEqual([]);
      expect(repo.hasCheckIn).not.toHaveBeenCalled();
      expect(repo.cancelRegistration).not.toHaveBeenCalled();
      expect(repo.cancelSessionBookings).not.toHaveBeenCalled();
    });

    it("answers it even after the event was cancelled, which already cancelled everyone", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        status: "cancelled",
        cancelledAt: NOW,
      });
      repo.findRegistration.mockResolvedValue(cancelledRegistration);

      await expect(
        service.cancelMyRegistration(eventId, actor),
      ).resolves.toMatchObject({
        registration: { status: "cancelled" },
      });
    });

    it("answers it even after registration has closed", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        registrationClosesAt: new Date(NOW.getTime() - HOUR),
      });
      repo.findRegistration.mockResolvedValue(cancelledRegistration);

      await expect(
        service.cancelMyRegistration(eventId, actor),
      ).resolves.toMatchObject({ registration: { status: "cancelled" } });
    });
  });

  describe("until registration closes", () => {
    it("may cancel while registration is still open", async () => {
      const { service, repo } = setupHolder();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        registrationClosesAt: new Date(NOW.getTime() + HOUR),
      });

      await expect(
        service.cancelMyRegistration(eventId, actor),
      ).resolves.toMatchObject({ registration: { status: "cancelled" } });
    });

    it("may not cancel after the closing time: CANCELLATION_CLOSED, and nothing is written", async () => {
      const { service, repo } = setupHolder();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        registrationClosesAt: new Date(NOW.getTime() - HOUR),
      });

      const failure = await service
        .cancelMyRegistration(eventId, actor)
        .catch((error) => error);

      expect(failure).toBeInstanceOf(ConflictError);
      expect(failure).toMatchObject({
        status: 409,
        code: "CANCELLATION_CLOSED",
      });
      expect(repo.cancelRegistration).not.toHaveBeenCalled();
      expect(repo.cancelSessionBookings).not.toHaveBeenCalled();
    });

    it("closes when the event starts if no closing time was set", async () => {
      const { service, repo } = setupHolder();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        startAt: new Date(NOW.getTime() - HOUR),
        endAt: new Date(NOW.getTime() + HOUR),
      });

      await expect(
        service.cancelMyRegistration(eventId, actor),
      ).rejects.toMatchObject({ code: "CANCELLATION_CLOSED" });
    });

    it("refuses at the exact closing moment, as registering does", async () => {
      const { service, repo } = setupHolder();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        registrationClosesAt: NOW,
      });

      await expect(
        service.cancelMyRegistration(eventId, actor),
      ).rejects.toMatchObject({ code: "CANCELLATION_CLOSED" });
    });
  });

  describe("after check-in", () => {
    it("refuses with ALREADY_CHECKED_IN and writes nothing", async () => {
      const { service, repo, tx } = setupHolder();
      repo.hasCheckIn.mockResolvedValue(true);

      await expect(
        service.cancelMyRegistration(eventId, actor),
      ).rejects.toMatchObject({ status: 409, code: "ALREADY_CHECKED_IN" });
      expect(repo.hasCheckIn).toHaveBeenCalledWith(tx, heldRegistration.id);
      expect(repo.cancelRegistration).not.toHaveBeenCalled();
      expect(repo.cancelSessionBookings).not.toHaveBeenCalled();
    });
  });

  describe("when the registration changed under it", () => {
    it("answers 409 REGISTRATION_CHANGED and does not touch the session seats", async () => {
      const { service, repo } = setupHolder();
      repo.cancelRegistration.mockResolvedValue(null);

      await expect(
        service.cancelMyRegistration(eventId, actor),
      ).rejects.toMatchObject({ code: "REGISTRATION_CHANGED" });
      expect(repo.cancelSessionBookings).not.toHaveBeenCalled();
    });
  });
});
