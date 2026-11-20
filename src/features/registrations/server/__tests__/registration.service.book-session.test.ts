import { ConflictError, NotFoundError } from "../../../../core/http/errors";
import {
  actor,
  bookableSession,
  cancelledRegistration,
  eventId,
  heldBooking,
  heldRegistration,
  NOW,
  publishedEvent,
  sessionId,
  setupRegistrationService,
  userId,
} from "../../__fixtures__/registration-service";
import {
  sessionBookingParam,
  sessionBookingResponseSchema,
} from "../../schemas/registrations.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const HOUR = 60 * 60 * 1000;

/** The service of a user who holds a live event registration, the normal way to book. */
function setupRegistered(now: Date = NOW) {
  const setup = setupRegistrationService(now);
  setup.repo.findRegistration.mockResolvedValue(heldRegistration);
  return setup;
}

/** The booking was refused: a 409 with this code, and nothing was written. */
async function expectRefused(
  attempt: Promise<unknown>,
  code: string,
  upsert: jest.Mock,
) {
  const failure = await attempt.catch((e) => e);
  expect(failure).toBeInstanceOf(ConflictError);
  expect(failure).toMatchObject({ status: 409, code });
  expect(upsert).not.toHaveBeenCalled();
}

describe("registrationService.bookSession", () => {
  describe("a new booking", () => {
    it("saves it for the signed-in user and answers the booking", async () => {
      const { service, repo, tx } = setupRegistered();

      const booking = await service.bookSession(eventId, sessionId, actor);

      expect(repo.upsertSessionBooking).toHaveBeenCalledWith(tx, {
        sessionId,
        userId,
        at: NOW,
      });
      expect(booking).toEqual({
        id: heldBooking.id,
        sessionId,
        status: "registered",
        registeredAt: NOW.toISOString(),
      });
    });

    it("looks the session up in THIS event, under the event lock", async () => {
      const { service, repo, tx } = setupRegistered();

      await service.bookSession(eventId, sessionId, actor);

      expect(repo.lockEvent).toHaveBeenCalledWith(tx, eventId);
      expect(repo.findSessionForBooking).toHaveBeenCalledWith(
        tx,
        eventId,
        sessionId,
      );
    });

    it("matches the response schema and carries no user id", async () => {
      const { service } = setupRegistered();

      const booking = await service.bookSession(eventId, sessionId, actor);

      expect(() => sessionBookingResponseSchema.parse(booking)).not.toThrow();
      expect(Object.keys(booking).sort()).toEqual([
        "id",
        "registeredAt",
        "sessionId",
        "status",
      ]);
    });

    it("books again after a cancellation: the repository revives the row", async () => {
      const { service, repo } = setupRegistered();
      repo.findSessionBooking.mockResolvedValue({
        ...heldBooking,
        status: "cancelled",
        cancelledAt: new Date(NOW.getTime() - HOUR),
      });

      await expect(
        service.bookSession(eventId, sessionId, actor),
      ).resolves.toMatchObject({ status: "registered" });
      expect(repo.upsertSessionBooking).toHaveBeenCalledTimes(1);
    });

    it("lets a speaker of ANOTHER session book this one", async () => {
      const { service, repo } = setupRegistered();
      // The check is per session: speaking elsewhere in the event is not asked here.
      repo.isSpeakerOfSession.mockResolvedValue(false);

      await service.bookSession(eventId, sessionId, actor);

      expect(repo.isSpeakerOfSession).toHaveBeenCalledWith(
        expect.anything(),
        userId,
        sessionId,
      );
      expect(repo.isSpeakerOfEvent).not.toHaveBeenCalled();
    });
  });

  describe("the event registration", () => {
    it("answers 409 EVENT_REGISTRATION_REQUIRED to a person who never registered", async () => {
      const { service, repo } = setupRegistrationService();
      repo.findRegistration.mockResolvedValue(null);

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "EVENT_REGISTRATION_REQUIRED",
        repo.upsertSessionBooking,
      );
      expect(repo.countSessionSeatsTaken).not.toHaveBeenCalled();
    });

    it("answers 409 EVENT_REGISTRATION_REQUIRED to a person who cancelled theirs", async () => {
      const { service, repo } = setupRegistrationService();
      repo.findRegistration.mockResolvedValue(cancelledRegistration);

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "EVENT_REGISTRATION_REQUIRED",
        repo.upsertSessionBooking,
      );
      expect(repo.countSessionSeatsTaken).not.toHaveBeenCalled();
    });

    it("looks for the registration of this event and this user", async () => {
      const { service, repo, tx } = setupRegistered();

      await service.bookSession(eventId, sessionId, actor);

      expect(repo.findRegistration).toHaveBeenCalledWith(tx, eventId, userId);
    });
  });

  describe("when booking is open", () => {
    it("is refused once the session has started, even for a registered person", async () => {
      // Registered long ago, books after the session started (or ended): too late.
      const { service, repo } = setupRegistered(
        new Date(bookableSession.startAt!.getTime() + HOUR),
      );

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "SESSION_STARTED",
        repo.upsertSessionBooking,
      );
    });

    it("is refused at the very moment the session starts", async () => {
      const { service, repo } = setupRegistered(bookableSession.startAt!);

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "SESSION_STARTED",
        repo.upsertSessionBooking,
      );
    });

    it("is open until the session starts", async () => {
      const { service } = setupRegistered(
        new Date(bookableSession.startAt!.getTime() - 1000),
      );

      await expect(
        service.bookSession(eventId, sessionId, actor),
      ).resolves.toMatchObject({ status: "registered" });
    });

    it("is refused for a cancelled session", async () => {
      const { service, repo } = setupRegistered();
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        status: "cancelled",
      });

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "SESSION_CANCELLED",
        repo.upsertSessionBooking,
      );
    });

    it("is refused for a session that needs no booking", async () => {
      const { service, repo } = setupRegistered();
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        requiresRegistration: false,
      });

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "SESSION_NOT_BOOKABLE",
        repo.upsertSessionBooking,
      );
    });

    it("is refused for an in-person session whose hall is not chosen yet", async () => {
      const { service, repo } = setupRegistered();
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        hallCapacity: null,
      });

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "SESSION_NOT_BOOKABLE",
        repo.upsertSessionBooking,
      );
    });

    it("is refused for a cancelled event", async () => {
      const { service, repo } = setupRegistered();
      repo.lockEvent.mockResolvedValue({
        ...publishedEvent,
        status: "cancelled",
      });

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "EVENT_CANCELLED",
        repo.upsertSessionBooking,
      );
    });
  });

  describe("not found", () => {
    it("answers 404 for an event that does not exist", async () => {
      const { service, repo } = setupRegistered();
      repo.lockEvent.mockResolvedValue(null);

      await expect(
        service.bookSession(eventId, sessionId, actor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.findSessionForBooking).not.toHaveBeenCalled();
    });

    it("answers 404 for a draft event, as if it did not exist", async () => {
      const { service, repo } = setupRegistered();
      repo.lockEvent.mockResolvedValue({ ...publishedEvent, status: "draft" });

      await expect(
        service.bookSession(eventId, sessionId, actor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.findSessionForBooking).not.toHaveBeenCalled();
    });

    it("answers 404 for a session that is not in this event", async () => {
      const { service, repo } = setupRegistered();
      repo.findSessionForBooking.mockResolvedValue(null);

      await expect(
        service.bookSession(eventId, sessionId, actor),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.upsertSessionBooking).not.toHaveBeenCalled();
    });

    it("answers 404 for a draft session, as if it did not exist", async () => {
      const { service, repo } = setupRegistered();
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        status: "draft",
      });

      await expect(
        service.bookSession(eventId, sessionId, actor),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("booking twice", () => {
    it("answers 409 ALREADY_BOOKED with a message that says so, and books nothing", async () => {
      const { service, repo } = setupRegistered();
      repo.findSessionBooking.mockResolvedValue(heldBooking);

      const failure = await service
        .bookSession(eventId, sessionId, actor)
        .catch((e) => e);

      expect(failure).toBeInstanceOf(ConflictError);
      expect(failure).toMatchObject({
        status: 409,
        code: "ALREADY_BOOKED",
        message: "You have already booked a seat here",
      });
      expect(repo.upsertSessionBooking).not.toHaveBeenCalled();
    });

    it("says ALREADY_BOOKED even when the session is now full", async () => {
      const { service, repo } = setupRegistered();
      repo.findSessionBooking.mockResolvedValue(heldBooking);
      repo.countSessionSeatsTaken.mockResolvedValue(30);

      await expect(
        service.bookSession(eventId, sessionId, actor),
      ).rejects.toMatchObject({ code: "ALREADY_BOOKED" });
    });

    it("answers ALREADY_BOOKED when the write finds the row already registered", async () => {
      const { service, repo } = setupRegistered();
      repo.upsertSessionBooking.mockResolvedValue(null);

      await expect(
        service.bookSession(eventId, sessionId, actor),
      ).rejects.toMatchObject({ code: "ALREADY_BOOKED" });
    });
  });

  describe("speakers", () => {
    it("refuses a speaker of this session", async () => {
      const { service, repo } = setupRegistered();
      repo.isSpeakerOfSession.mockResolvedValue(true);

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "SPEAKER_CANNOT_BOOK",
        repo.upsertSessionBooking,
      );
    });
  });

  describe("the price", () => {
    it("answers 409 PAYMENT_NOT_AVAILABLE_YET for a paid session", async () => {
      const { service, repo } = setupRegistered();
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        price: 50000,
      });

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "PAYMENT_NOT_AVAILABLE_YET",
        repo.upsertSessionBooking,
      );
    });
  });

  describe("seats", () => {
    it("books the last seat", async () => {
      const { service, repo } = setupRegistered();
      repo.countSessionSeatsTaken.mockResolvedValue(29);

      await expect(
        service.bookSession(eventId, sessionId, actor),
      ).resolves.toMatchObject({ status: "registered" });
    });

    it("answers 409 SESSION_FULL when every seat of the hall is taken", async () => {
      const { service, repo } = setupRegistered();
      repo.countSessionSeatsTaken.mockResolvedValue(30);

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "SESSION_FULL",
        repo.upsertSessionBooking,
      );
    });

    it("counts the seats of this session only", async () => {
      const { service, repo, tx } = setupRegistered();

      await service.bookSession(eventId, sessionId, actor);

      expect(repo.countSessionSeatsTaken).toHaveBeenCalledWith(tx, sessionId);
    });

    it("books an online session, which has no hall and no seat limit", async () => {
      const { service, repo } = setupRegistered();
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        mode: "online",
        hallCapacity: null,
      });

      await expect(
        service.bookSession(eventId, sessionId, actor),
      ).resolves.toMatchObject({ status: "registered" });
      expect(repo.countSessionSeatsTaken).not.toHaveBeenCalled();
    });

    it("still needs the event registration for an online session", async () => {
      const { service, repo } = setupRegistrationService();
      repo.findRegistration.mockResolvedValue(null);
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        mode: "online",
        hallCapacity: null,
      });

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "EVENT_REGISTRATION_REQUIRED",
        repo.upsertSessionBooking,
      );
    });

    it("checks a hybrid session against its hall like an in-person one", async () => {
      const { service, repo } = setupRegistered();
      repo.findSessionForBooking.mockResolvedValue({
        ...bookableSession,
        mode: "hybrid",
      });
      repo.countSessionSeatsTaken.mockResolvedValue(30);

      await expectRefused(
        service.bookSession(eventId, sessionId, actor),
        "SESSION_FULL",
        repo.upsertSessionBooking,
      );
    });
  });
});

describe("sessionBookingParam", () => {
  const valid = { eventId, sessionId };

  it("accepts two uuids", () => {
    expect(sessionBookingParam.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["a bad event id", { ...valid, eventId: "nope" }],
    ["a bad session id", { ...valid, sessionId: "nope" }],
    ["a missing session id", { eventId }],
  ])("rejects %s", (_name, params) => {
    expect(sessionBookingParam.safeParse(params).success).toBe(false);
  });
});

describe("sessionBookingResponseSchema", () => {
  const valid = {
    id: heldBooking.id,
    sessionId,
    status: "registered",
    registeredAt: "2026-11-02T10:00:00.000Z",
  };

  it("accepts a booking", () => {
    expect(sessionBookingResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a bad id, an unknown status and a date that is not ISO", () => {
    expect(
      sessionBookingResponseSchema.safeParse({ ...valid, id: "nope" }).success,
    ).toBe(false);
    expect(
      sessionBookingResponseSchema.safeParse({ ...valid, status: "pending" })
        .success,
    ).toBe(false);
    expect(
      sessionBookingResponseSchema.safeParse({
        ...valid,
        registeredAt: "yesterday",
      }).success,
    ).toBe(false);
  });
});
