import {
  actor,
  cancelledRegistration,
  eventId,
  heldRegistration,
  publishedEvent,
  setupRegistrationService,
  userId,
} from "../../__fixtures__/registration-service";
import { myRegistrationResponseSchema } from "../../schemas/registrations.schemas";

// Empty factory: the DB client and env are never loaded.
jest.mock("../registration.repository", () => ({}));

const sessionA = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const sessionB = "7b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e";

/** What the repository finds for a registration: the row plus the event's price fields. */
const found = (registration = heldRegistration, ticketPrice = 0) => ({
  registration,
  event: { ticketPrice, currency: publishedEvent.currency },
});

describe("registrationService.getMyRegistration", () => {
  it("answers null and no sessions for someone who never registered", async () => {
    const { service, repo } = setupRegistrationService();

    const result = await service.getMyRegistration(eventId, actor);

    expect(result).toEqual({ registration: null, bookedSessionIds: [] });
    expect(repo.findBookedSessionIds).not.toHaveBeenCalled();
  });

  it("only ever asks about the signed-in user", async () => {
    const { service, repo } = setupRegistrationService();

    await service.getMyRegistration(eventId, actor);

    expect(repo.findOwnRegistration).toHaveBeenCalledWith(eventId, userId);
  });

  it("answers the user's ticket and the sessions they hold a seat in", async () => {
    const { service, repo } = setupRegistrationService();
    repo.findOwnRegistration.mockResolvedValue(found());
    repo.findBookedSessionIds.mockResolvedValue([sessionA, sessionB]);

    const result = await service.getMyRegistration(eventId, actor);

    expect(repo.findBookedSessionIds).toHaveBeenCalledWith(eventId, userId);
    expect(result.registration).toMatchObject({
      eventId,
      status: "registered",
      ticketCode: heldRegistration.ticketCode,
      amount: 0,
      currency: "INR",
      reason: "free",
    });
    expect(result.bookedSessionIds).toEqual([sessionA, sessionB]);
  });

  it("answers a body that matches the response schema and hides the user and internal dates", async () => {
    const { service, repo } = setupRegistrationService();
    repo.findOwnRegistration.mockResolvedValue(found());
    repo.findBookedSessionIds.mockResolvedValue([sessionA]);

    const result = await service.getMyRegistration(eventId, actor);

    expect(() => myRegistrationResponseSchema.parse(result)).not.toThrow();
    expect(result.registration).not.toHaveProperty("userId");
    expect(result.registration).not.toHaveProperty("cancelledAt");
    expect(result.registration).not.toHaveProperty("updatedAt");
  });

  it("shows a ticket on a paid event as complimentary, the only way in without paying so far", async () => {
    const { service, repo } = setupRegistrationService();
    repo.findOwnRegistration.mockResolvedValue(
      found(heldRegistration, 150_000),
    );

    const result = await service.getMyRegistration(eventId, actor);

    expect(result.registration).toMatchObject({
      amount: 0,
      reason: "complimentary_speaker",
    });
  });

  it("answers a cancelled registration as cancelled, without looking up sessions", async () => {
    const { service, repo } = setupRegistrationService();
    repo.findOwnRegistration.mockResolvedValue(found(cancelledRegistration));

    const result = await service.getMyRegistration(eventId, actor);

    expect(result.registration?.status).toBe("cancelled");
    expect(result.bookedSessionIds).toEqual([]);
    expect(repo.findBookedSessionIds).not.toHaveBeenCalled();
  });

  it("is not a transaction: it only reads", async () => {
    const { service, repo } = setupRegistrationService();
    repo.findOwnRegistration.mockResolvedValue(found());

    await service.getMyRegistration(eventId, actor);

    expect(repo.transaction).not.toHaveBeenCalled();
    expect(repo.upsertRegistration).not.toHaveBeenCalled();
  });
});
