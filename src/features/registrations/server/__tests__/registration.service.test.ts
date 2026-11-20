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
import { registrationResponseSchema } from "../../schemas/registrations.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const HOUR = 60 * 60 * 1000;

describe("registrationService.register", () => {
  describe("a new registration", () => {
    it("saves it for the signed-in user and answers the ticket", async () => {
      const { service, repo, tx } = setupRegistrationService();

      const registration = await service.register(eventId, actor);

      expect(repo.upsertRegistration).toHaveBeenCalledWith(tx, {
        eventId,
        userId,
        ticketCode: "ESEVT7K3Q9P",
        at: NOW,
      });
      expect(registration).toMatchObject({
        eventId,
        status: "registered",
        ticketCode: "ESEVT7K3Q9P",
        amount: 0,
        currency: "INR",
        reason: "free",
      });
    });

    it("answers a DTO that matches the response schema and hides the user and internal dates", async () => {
      const { service } = setupRegistrationService();

      const registration = await service.register(eventId, actor);

      expect(() =>
        registrationResponseSchema.parse(registration),
      ).not.toThrow();
      expect(registration).not.toHaveProperty("userId");
      expect(registration).not.toHaveProperty("cancelledAt");
      expect(registration).not.toHaveProperty("updatedAt");
    });

    it("locks the event before it counts the seats, inside one transaction", async () => {
      const { service, repo, tx } = setupRegistrationService();

      await service.register(eventId, actor);

      expect(repo.transaction).toHaveBeenCalledTimes(1);
      expect(repo.lockEvent).toHaveBeenCalledWith(tx, eventId);
      expect(repo.lockEvent.mock.invocationCallOrder[0]).toBeLessThan(
        repo.countSeatsTaken.mock.invocationCallOrder[0],
      );
      expect(repo.countSeatsTaken.mock.invocationCallOrder[0]).toBeLessThan(
        repo.upsertRegistration.mock.invocationCallOrder[0],
      );
    });

    it("does not count seats when the event has no capacity limit", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({ ...publishedEvent, capacity: null });
      repo.countSeatsTaken.mockResolvedValue(10_000);

      await expect(service.register(eventId, actor)).resolves.toMatchObject({
        status: "registered",
      });
      expect(repo.countSeatsTaken).not.toHaveBeenCalled();
    });

    it("takes the last seat, and refuses the next person with EVENT_FULL", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({ ...publishedEvent, capacity: 100 });
      repo.countSeatsTaken.mockResolvedValue(99);
      await expect(service.register(eventId, actor)).resolves.toMatchObject({
        status: "registered",
      });

      repo.countSeatsTaken.mockResolvedValue(100);
      repo.upsertRegistration.mockClear();

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        status: 409,
        code: "EVENT_FULL",
      });
      expect(repo.upsertRegistration).not.toHaveBeenCalled();
    });

    it("does not ask who the speakers are on a free event", async () => {
      const { service, repo } = setupRegistrationService();

      await service.register(eventId, actor);

      expect(repo.isSpeakerOfEvent).not.toHaveBeenCalled();
    });
  });

  describe("registering again", () => {
    it("answers 409 ALREADY_REGISTERED with a message that says so, and creates nothing", async () => {
      const { service, repo } = setupRegistrationService();
      repo.findRegistration.mockResolvedValue(heldRegistration);

      const failure = await service.register(eventId, actor).catch((e) => e);

      expect(failure).toBeInstanceOf(ConflictError);
      expect(failure).toMatchObject({
        status: 409,
        code: "ALREADY_REGISTERED",
        message: "You are already registered for this event",
      });
      expect(repo.upsertRegistration).not.toHaveBeenCalled();
    });

    it("says ALREADY_REGISTERED even when the event is now full", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({ ...publishedEvent, capacity: 1 });
      repo.findRegistration.mockResolvedValue(heldRegistration);
      repo.countSeatsTaken.mockResolvedValue(1);

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        code: "ALREADY_REGISTERED",
      });
      expect(repo.countSeatsTaken).not.toHaveBeenCalled();
    });

    it("says ALREADY_REGISTERED even after registration has closed, not REGISTRATION_CLOSED", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        registrationClosesAt: new Date(NOW.getTime() - HOUR),
      });
      repo.findRegistration.mockResolvedValue(heldRegistration);

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        code: "ALREADY_REGISTERED",
      });
    });

    it("registers again after a cancellation, with the normal seat check", async () => {
      const { service, repo } = setupRegistrationService();
      repo.findRegistration.mockResolvedValue(cancelledRegistration);
      repo.lockEvent.mockResolvedValue({ ...publishedEvent, capacity: 1 });
      repo.countSeatsTaken.mockResolvedValue(1);

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        code: "EVENT_FULL",
      });

      repo.countSeatsTaken.mockResolvedValue(0);
      await expect(service.register(eventId, actor)).resolves.toMatchObject({
        status: "registered",
      });
      expect(repo.upsertRegistration).toHaveBeenCalledTimes(1);
    });

    it("issues a new ticket code when registering again after a cancellation", async () => {
      const { service, repo, newTicketCode } = setupRegistrationService();
      repo.findRegistration.mockResolvedValue(cancelledRegistration);
      newTicketCode.mockReset().mockReturnValue("ESEVTNEWCODE");

      await service.register(eventId, actor);

      expect(repo.upsertRegistration.mock.calls[0][1].ticketCode).toBe(
        "ESEVTNEWCODE",
      );
      expect("ESEVTNEWCODE").not.toBe(cancelledRegistration.ticketCode);
    });

    it("answers ALREADY_REGISTERED when the insert finds the row already registered", async () => {
      const { service, repo } = setupRegistrationService();
      repo.upsertRegistration.mockResolvedValue({ kind: "already_registered" });

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        status: 409,
        code: "ALREADY_REGISTERED",
      });
    });
  });

  describe("the ticket code", () => {
    it("tries again with a new code when the first one is already taken", async () => {
      const { service, repo, newTicketCode } = setupRegistrationService();
      newTicketCode
        .mockReset()
        .mockReturnValueOnce("ESEVTAAAAAA")
        .mockReturnValueOnce("ESEVTBBBBBB");
      repo.upsertRegistration
        .mockResolvedValueOnce({ kind: "ticket_code_taken" })
        .mockResolvedValueOnce({
          kind: "saved",
          registration: { ...heldRegistration, ticketCode: "ESEVTBBBBBB" },
        });

      const registration = await service.register(eventId, actor);

      expect(registration.ticketCode).toBe("ESEVTBBBBBB");
      expect(repo.upsertRegistration).toHaveBeenCalledTimes(2);
      expect(repo.upsertRegistration.mock.calls[0][1].ticketCode).toBe(
        "ESEVTAAAAAA",
      );
      expect(repo.upsertRegistration.mock.calls[1][1].ticketCode).toBe(
        "ESEVTBBBBBB",
      );
    });

    it("gives up after three taken codes with a plain error (a 500, not a 409)", async () => {
      const { service, repo } = setupRegistrationService();
      repo.upsertRegistration.mockResolvedValue({ kind: "ticket_code_taken" });

      const failure = service.register(eventId, actor);

      await expect(failure).rejects.toThrow("unique ticket code");
      await expect(failure).rejects.not.toBeInstanceOf(ConflictError);
      expect(repo.upsertRegistration).toHaveBeenCalledTimes(3);
    });
  });

  describe("which events can be registered for", () => {
    it("answers 404 for an event that does not exist", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue(null);

      await expect(service.register(eventId, actor)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(repo.upsertRegistration).not.toHaveBeenCalled();
    });

    it("answers 404 for a draft, so its existence is not revealed", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({ ...publishedEvent, status: "draft" });

      await expect(service.register(eventId, actor)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(repo.upsertRegistration).not.toHaveBeenCalled();
    });

    it("refuses a cancelled event with EVENT_CANCELLED", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        status: "cancelled",
        cancelledAt: NOW,
      });

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        status: 409,
        code: "EVENT_CANCELLED",
      });
    });

    it("refuses an event that has ended with EVENT_ENDED", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        startAt: new Date(NOW.getTime() - 5 * HOUR),
        endAt: new Date(NOW.getTime() - HOUR),
      });

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        code: "EVENT_ENDED",
      });
    });

    it("refuses before registration opens with REGISTRATION_NOT_OPEN", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        registrationOpensAt: new Date(NOW.getTime() + HOUR),
      });

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        code: "REGISTRATION_NOT_OPEN",
      });
    });

    it("accepts a registration once the opening time has passed", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        registrationOpensAt: new Date(NOW.getTime() - HOUR),
      });

      await expect(service.register(eventId, actor)).resolves.toMatchObject({
        status: "registered",
      });
    });

    it("refuses after the closing time with REGISTRATION_CLOSED", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        registrationClosesAt: new Date(NOW.getTime() - HOUR),
      });

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        code: "REGISTRATION_CLOSED",
      });
    });

    it("closes when the event starts if no closing time was set", async () => {
      const { service, repo } = setupRegistrationService();
      // Started an hour ago, ends in an hour: not over, but registration is closed.
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        startAt: new Date(NOW.getTime() - HOUR),
        endAt: new Date(NOW.getTime() + HOUR),
      });

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        code: "REGISTRATION_CLOSED",
      });
    });
  });

  describe("the price", () => {
    const paidEvent = { ...publishedEvent, ticketPrice: 150_000 };

    it("refuses a paid event for an ordinary user with PAYMENT_NOT_AVAILABLE_YET", async () => {
      const { service, repo, tx } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue(paidEvent);

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        status: 409,
        code: "PAYMENT_NOT_AVAILABLE_YET",
      });
      expect(repo.isSpeakerOfEvent).toHaveBeenCalledWith(tx, userId, eventId);
      expect(repo.upsertRegistration).not.toHaveBeenCalled();
    });

    it("gives a speaker of the event a complimentary ticket on a paid event", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue(paidEvent);
      repo.isSpeakerOfEvent.mockResolvedValue(true);

      const registration = await service.register(eventId, actor);

      expect(registration).toMatchObject({
        status: "registered",
        amount: 0,
        currency: "INR",
        reason: "complimentary_speaker",
      });
    });

    it("still applies the seat limit to a complimentary ticket", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue({ ...paidEvent, capacity: 5 });
      repo.isSpeakerOfEvent.mockResolvedValue(true);
      repo.countSeatsTaken.mockResolvedValue(5);

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        code: "EVENT_FULL",
      });
    });

    it("says ALREADY_REGISTERED on a paid event for a held ticket, without a price lookup", async () => {
      const { service, repo } = setupRegistrationService();
      repo.lockEvent.mockResolvedValue(paidEvent);
      repo.findRegistration.mockResolvedValue(heldRegistration);

      await expect(service.register(eventId, actor)).rejects.toMatchObject({
        code: "ALREADY_REGISTERED",
      });
      expect(repo.isSpeakerOfEvent).not.toHaveBeenCalled();
    });
  });
});
