import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../../core/http/errors";
import {
  admin,
  eventId,
  eventRecord,
  NOW,
  organizer,
  otherOrganizer,
  setupEventService,
} from "../../__fixtures__/event-service";
import { eventResponseSchema } from "../../schemas/events.schemas";

// Empty factories: the DB client, Strapi client and env are never loaded.
jest.mock("../event.repository", () => ({}));
// The Strapi clients are never loaded; the image helpers are pure, so the real ones are kept.
jest.mock("../../../cms/server", () =>
  jest.requireActual("../../../cms/server/image-upload"),
);
jest.mock("../../../organizer/server", () => ({}));

/** A published event that has not started: the one an organizer may cancel. */
const published = {
  ...eventRecord,
  status: "published" as const,
  publishedAt: NOW,
};

function setup() {
  const ctx = setupEventService();
  // The access check returns the WHOLE event (a draft by default); this one is published. The
  // service reads its status and dates from it, so a test sets the event's state here.
  ctx.repo.findEventById.mockResolvedValue(published);
  return ctx;
}

describe("eventService.cancelEvent", () => {
  it("cancels the event at the current time and answers it as cancelled", async () => {
    const { service, repo } = setup();

    const dto = await service.cancelEvent(eventId, organizer);

    expect(repo.cancelEvent).toHaveBeenCalledWith(eventId, NOW);
    expect(() => eventResponseSchema.parse(dto)).not.toThrow();
    expect(dto.status).toBe("cancelled");
    expect(dto).not.toHaveProperty("organizerId");
    expect(dto).not.toHaveProperty("cancelledAt");
  });

  it("leaves the Strapi page alone", async () => {
    const { service, strapi, media } = setup();

    await service.cancelEvent(eventId, organizer);

    expect(strapi.updateEventPage).not.toHaveBeenCalled();
    expect(strapi.deleteEventPage).not.toHaveBeenCalled();
    expect(media.deleteFile).not.toHaveBeenCalled();
  });

  describe("who may cancel", () => {
    it("refuses an admin (403) before touching anything: only an organizer cancels", async () => {
      const { service, repo } = setup();

      await expect(service.cancelEvent(eventId, admin)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(repo.findEventById).not.toHaveBeenCalled();
      expect(repo.cancelEvent).not.toHaveBeenCalled();
    });

    it("answers 404 for another organizer's event and cancels nothing", async () => {
      const { service, repo } = setup();

      await expect(
        service.cancelEvent(eventId, otherOrganizer),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.cancelEvent).not.toHaveBeenCalled();
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
        service.cancelEvent(eventId, organizer),
      ).rejects.toMatchObject({ code: "ORGANIZER_NOT_VERIFIED" });
      expect(repo.cancelEvent).not.toHaveBeenCalled();
    });

    it("answers 404 for an event that does not exist", async () => {
      const { service, repo } = setup();
      repo.findEventById.mockResolvedValue(null);

      await expect(
        service.cancelEvent(eventId, organizer),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("which events can be cancelled", () => {
    it("answers 409 EVENT_NOT_PUBLISHED for a draft: a draft is deleted, not cancelled", async () => {
      const { service, repo } = setup();
      repo.findEventById.mockResolvedValue({ ...published, status: "draft" });

      await expect(
        service.cancelEvent(eventId, organizer),
      ).rejects.toMatchObject({
        code: "EVENT_NOT_PUBLISHED",
      });
      expect(repo.cancelEvent).not.toHaveBeenCalled();
    });

    it("answers 409 EVENT_ENDED for a completed event (read-only)", async () => {
      const { service, repo } = setup();
      repo.findEventById.mockResolvedValue({
        ...published,
        startAt: new Date("2026-10-30T04:00:00.000Z"),
        endAt: new Date("2026-10-31T12:00:00.000Z"), // before NOW
      });

      await expect(
        service.cancelEvent(eventId, organizer),
      ).rejects.toBeInstanceOf(ConflictError);
      await expect(
        service.cancelEvent(eventId, organizer),
      ).rejects.toMatchObject({
        code: "EVENT_ENDED",
      });
      expect(repo.cancelEvent).not.toHaveBeenCalled();
    });

    it("can still cancel an event that is running right now (it has not ended)", async () => {
      const { service, repo } = setup();
      repo.findEventById.mockResolvedValue({
        ...published,
        startAt: new Date("2026-11-02T04:00:00.000Z"),
        endAt: new Date("2026-11-02T18:00:00.000Z"), // after NOW (10:00)
      });

      await expect(
        service.cancelEvent(eventId, organizer),
      ).resolves.toBeDefined();
      expect(repo.cancelEvent).toHaveBeenCalled();
    });

    it("answers an event that is already cancelled as it is, without writing again", async () => {
      const { service, repo } = setup();
      repo.findEventById.mockResolvedValue({
        ...published,
        status: "cancelled",
        cancelledAt: new Date("2026-11-01T10:00:00.000Z"),
      });

      const dto = await service.cancelEvent(eventId, organizer);

      expect(dto.status).toBe("cancelled");
      expect(repo.cancelEvent).not.toHaveBeenCalled();
      // The whole event came with the access check: nothing was read a second time.
      expect(repo.findEventRecord).not.toHaveBeenCalled();
    });
  });

  describe("two cancels at the same moment", () => {
    it("answers the cancelled event too when someone else cancelled it a moment earlier", async () => {
      const { service, repo } = setup();
      // The access check saw it published; the write finds it cancelled, so it is read again.
      repo.cancelEvent.mockResolvedValue(null);
      repo.findEventRecord.mockResolvedValue({
        ...published,
        status: "cancelled",
        cancelledAt: new Date("2026-11-02T09:59:59.000Z"),
      });

      const dto = await service.cancelEvent(eventId, organizer);

      expect(dto.status).toBe("cancelled");
    });

    it("answers 404 if the event vanished between the read and the write", async () => {
      const { service, repo } = setup();
      repo.cancelEvent.mockResolvedValue(null);
      repo.findEventRecord.mockResolvedValue(null);

      await expect(
        service.cancelEvent(eventId, organizer),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
