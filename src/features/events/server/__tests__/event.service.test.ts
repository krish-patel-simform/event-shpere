import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from "../../../../core/http/errors";
import {
  admin,
  organizer,
  organizerId,
  setupEventService as setup,
  venue,
  venueId,
} from "../../__fixtures__/event-service";
import {
  createEventBodySchema,
  eventResponseSchema,
} from "../../schemas/events.schemas";

// Empty factories: the DB client, Strapi client and env are never loaded.
jest.mock("../event.repository", () => ({}));
// The Strapi clients are never loaded; the image helpers are pure, so the real ones are kept.
jest.mock("../../../cms/server", () =>
  jest.requireActual("../../../cms/server/image-upload"),
);
jest.mock("../../../organizer/server", () => ({}));

const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000).toISOString();

const body = createEventBodySchema.parse({
  title: "Tech Conf 2026",
  startAt: hoursFromNow(48),
  endAt: hoursFromNow(56),
});

describe("eventService.createEvent", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it("creates a draft owned by the caller, linked to its Strapi page by one shared id", async () => {
    const { service, repo, strapi } = setup();

    const dto = await service.createEvent(body, organizer);

    const { eventId } = strapi.createEventPage.mock.calls[0][0] as {
      eventId: string;
    };
    expect(repo.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: eventId,
        organizerId,
        cmsEventId: "doc-new",
        title: "Tech Conf 2026",
        venueId: null,
        capacity: null,
        ticketPrice: 0,
        currency: "INR",
        timezone: "Asia/Kolkata",
      }),
    );
    expect(dto.status).toBe("draft");
    expect(dto.id).toBe(eventId);
  });

  it("returns a DTO that matches the response schema and hides internal fields", async () => {
    const { service } = setup();

    const dto = await service.createEvent(body, organizer);

    expect(() => eventResponseSchema.parse(dto)).not.toThrow();
    expect(dto).not.toHaveProperty("organizerId");
    expect(dto).not.toHaveProperty("cmsEventId");
  });

  it("copies the venue's time zone, whatever the form sent", async () => {
    const { service, repo } = setup();

    await service.createEvent(
      { ...body, venueId, timezone: "Asia/Tokyo" },
      organizer,
    );

    expect(repo.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ venueId, timezone: "America/New_York" }),
    );
  });

  it("uses the form's time zone when there is no venue", async () => {
    const { service, repo } = setup();

    await service.createEvent({ ...body, timezone: "Asia/Tokyo" }, organizer);

    expect(repo.findVenue).not.toHaveBeenCalled();
    expect(repo.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ venueId: null, timezone: "Asia/Tokyo" }),
    );
  });

  describe("who may create", () => {
    it("refuses an organizer an admin has not approved (403), before touching Strapi", async () => {
      const { service, repo, strapi, verification } = setup();
      verification.assertVerifiedOrganizer.mockRejectedValue(
        new ForbiddenError(
          "Your organizer account is waiting for admin approval",
          "ORGANIZER_NOT_VERIFIED",
        ),
      );

      const error = await service.createEvent(body, organizer).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.code).toBe("ORGANIZER_NOT_VERIFIED");
      expect(verification.assertVerifiedOrganizer).toHaveBeenCalledWith(
        organizer,
      );
      expect(strapi.createEventPage).not.toHaveBeenCalled();
      expect(repo.createEvent).not.toHaveBeenCalled();
    });

    it("stores the organizer's PROFILE id as the owner, never their user id", async () => {
      const { service, repo, verification } = setup();

      await expect(service.createEvent(body, organizer)).resolves.toMatchObject(
        { status: "draft" },
      );

      expect(verification.assertVerifiedOrganizer).toHaveBeenCalledWith(
        organizer,
      );
      expect(repo.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ organizerId }),
      );
      expect(organizerId).not.toBe(organizer.id);
    });

    it("refuses an admin (403): an admin has no organizer profile to own an event", async () => {
      const { service, repo, strapi, verification } = setup();

      const error = await service.createEvent(body, admin).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.message).toBe("Only an organizer can create events");
      expect(verification.assertVerifiedOrganizer).toHaveBeenCalledWith(admin);
      // Nothing is created anywhere, not even the empty page in Strapi.
      expect(strapi.createEventPage).not.toHaveBeenCalled();
      expect(repo.createEvent).not.toHaveBeenCalled();
    });
  });

  describe("venue", () => {
    it("404 when the venue does not exist, before touching Strapi", async () => {
      const { service, repo, strapi } = setup();
      repo.findVenue.mockResolvedValue(null);

      await expect(
        service.createEvent({ ...body, venueId }, organizer),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(strapi.createEventPage).not.toHaveBeenCalled();
    });

    it("409 VENUE_INACTIVE for a deactivated venue", async () => {
      const { service, repo, strapi } = setup();
      repo.findVenue.mockResolvedValue({ ...venue, isActive: false });

      const error = await service
        .createEvent({ ...body, venueId }, organizer)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect(error.code).toBe("VENUE_INACTIVE");
      expect(strapi.createEventPage).not.toHaveBeenCalled();
    });
  });

  describe("Strapi and Postgres together", () => {
    it("503 and nothing saved when Strapi cannot create the page", async () => {
      const { service, repo, strapi } = setup();
      strapi.createEventPage.mockRejectedValue(
        new Error("connect ECONNREFUSED"),
      );

      const error = await service.createEvent(body, organizer).catch((e) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error.code).toBe("CMS_UNAVAILABLE");
      expect(repo.createEvent).not.toHaveBeenCalled();
    });

    it("removes the Strapi page again when the insert fails, and rethrows the real error", async () => {
      const { service, repo, strapi } = setup();
      const dbError = new Error("insert failed");
      repo.createEvent.mockRejectedValue(dbError);

      await expect(service.createEvent(body, organizer)).rejects.toBe(dbError);
      expect(strapi.deleteEventPage).toHaveBeenCalledWith("doc-new");
    });

    it("still rethrows the insert error when the cleanup fails too", async () => {
      const { service, repo, strapi } = setup();
      const dbError = new Error("insert failed");
      repo.createEvent.mockRejectedValue(dbError);
      strapi.deleteEventPage.mockRejectedValue(new Error("strapi down"));

      await expect(service.createEvent(body, organizer)).rejects.toBe(dbError);
      // The orphan's id is logged so it can be removed by hand.
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("doc-new"),
        "strapi down",
      );
    });
  });
});
