import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../../core/http/errors";
import {
  admin,
  attendee,
  eventId,
  eventRecord,
  eventRef,
  managedRow,
  NOW,
  organizer,
  organizerId,
  otherOrganizer,
  setupEventService,
  venue,
  venueId,
} from "../../__fixtures__/event-service";
import {
  eventOverviewSchema,
  eventTabCountsSchema,
  myEventListQuerySchema,
  myEventListResponseSchema,
} from "../../schemas/event-manage.schemas";
import { updateEventBodySchema } from "../../schemas/events.schemas";

// Empty factories: the DB client, Strapi client and env are never loaded.
jest.mock("../event.repository", () => ({}));
jest.mock("../../../cms/server", () => ({}));
jest.mock("../../../organizer/server", () => ({}));

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

const query = (overrides: Record<string, unknown> = {}) =>
  myEventListQuerySchema.parse(overrides);

const paragraph = (text: string) => ({
  type: "paragraph",
  children: [{ type: "text", text }],
});

describe("eventService.listOwnEvents", () => {
  it("asks for the caller's own events: the owner comes from the login, not the query", async () => {
    const { service, repo } = setup();

    await service.listOwnEvents(query({ page: 3, pageSize: 10 }), organizer);

    expect(repo.listOwnEvents).toHaveBeenCalledWith({
      organizerId,
      tab: "all",
      search: undefined,
      sort: "soonest",
      now: NOW,
      limit: 10,
      offset: 20,
    });
  });

  it("passes the tab, the search and the sort on", async () => {
    const { service, repo } = setup();

    await service.listOwnEvents(
      query({ status: "published", search: "summit", sort: "latest" }),
      organizer,
    );

    expect(repo.listOwnEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: "published",
        search: "summit",
        sort: "latest",
      }),
    );
  });

  it("treats a blank search as no search", async () => {
    const { service, repo } = setup();

    await service.listOwnEvents(query({ search: "   " }), organizer);

    expect(repo.listOwnEvents).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    );
  });

  it("returns the page, its meta and events the organizer's screen can use", async () => {
    const { service, repo } = setup();
    repo.listOwnEvents.mockResolvedValue({
      rows: [
        managedRow,
        {
          ...managedRow,
          id: "2d6f0e1a-1111-4222-8333-444455556666",
          venueId: null,
          venueName: null,
        },
      ],
      total: 12,
    });

    const result = await service.listOwnEvents(query({ page: 2 }), organizer);

    expect(result.meta).toEqual({ page: 2, pageSize: 10, total: 12 });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: eventId,
      status: "draft",
      venue: {
        id: venueId,
        name: "Hotel Orchid",
        city: "Pune",
        state: "Maharashtra",
      },
      sessions: { total: 2, scheduled: 0, cancelled: 0 },
    });
    expect(result.items[1].venue).toBeNull();
    expect(() => myEventListResponseSchema.parse(result.items)).not.toThrow();
  });

  it("shows a published event whose end has passed as completed", async () => {
    const { service, repo } = setup();
    repo.listOwnEvents.mockResolvedValue({
      rows: [
        {
          ...managedRow,
          status: "published",
          startAt: new Date("2026-10-30T04:00:00.000Z"),
          endAt: new Date("2026-10-30T12:00:00.000Z"),
        },
        {
          ...managedRow,
          id: "2d6f0e1a-1111-4222-8333-444455556666",
          status: "published",
        },
      ],
      total: 2,
    });

    const { items } = await service.listOwnEvents(query(), organizer);

    expect(items.map((item) => item.status)).toEqual([
      "completed",
      "published",
    ]);
  });

  it("does not hide a draft whose date passed: it stays a draft", async () => {
    const { service, repo } = setup();
    repo.listOwnEvents.mockResolvedValue({
      rows: [{ ...managedRow, endAt: new Date("2026-10-30T12:00:00.000Z") }],
      total: 1,
    });

    const { items } = await service.listOwnEvents(query(), organizer);

    expect(items[0].status).toBe("draft");
  });

  it("gives an admin an empty page: an admin owns no events, so nothing is queried", async () => {
    const { service, repo } = setup();

    const result = await service.listOwnEvents(
      query({ page: 2, pageSize: 20 }),
      admin,
    );

    expect(result).toEqual({
      items: [],
      meta: { page: 2, pageSize: 20, total: 0 },
    });
    expect(repo.listOwnEvents).not.toHaveBeenCalled();
  });

  it("asks for the events of the caller's organizer PROFILE, not of their user id", async () => {
    const { service, repo } = setup();

    await service.listOwnEvents(query(), organizer);

    expect(repo.listOwnEvents).toHaveBeenCalledWith(
      expect.objectContaining({ organizerId }),
    );
    expect(repo.listOwnEvents).not.toHaveBeenCalledWith(
      expect.objectContaining({ organizerId: organizer.id }),
    );
  });

  it("refuses a user with no event permission (403), before any query", async () => {
    const { service, repo } = setup();

    await expect(
      service.listOwnEvents(query(), attendee),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.listOwnEvents).not.toHaveBeenCalled();
  });

  it("stops an organizer an admin has not approved", async () => {
    const { service, repo, verification } = setup();
    verification.assertVerifiedOrganizer.mockRejectedValue(
      new ForbiddenError(
        "waiting for admin approval",
        "ORGANIZER_NOT_VERIFIED",
      ),
    );

    await expect(
      service.listOwnEvents(query(), organizer),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.listOwnEvents).not.toHaveBeenCalled();
  });
});

describe("eventService.countOwnEvents", () => {
  it("counts the caller's own events by tab", async () => {
    const { service, repo } = setup();
    const counts = {
      all: 5,
      draft: 1,
      published: 2,
      completed: 1,
      cancelled: 1,
    };
    repo.countOwnEventsByTab.mockResolvedValue(counts);

    const result = await service.countOwnEvents(organizer);

    expect(repo.countOwnEventsByTab).toHaveBeenCalledWith(organizerId, NOW);
    expect(result).toEqual(counts);
    expect(() => eventTabCountsSchema.parse(result)).not.toThrow();
  });

  it("counts nothing for an admin, who owns no events, without a query", async () => {
    const { service, repo } = setup();

    const result = await service.countOwnEvents(admin);

    expect(result).toEqual({
      all: 0,
      draft: 0,
      published: 0,
      completed: 0,
      cancelled: 0,
    });
    expect(() => eventTabCountsSchema.parse(result)).not.toThrow();
    expect(repo.countOwnEventsByTab).not.toHaveBeenCalled();
  });

  it("refuses a user with no event permission", async () => {
    const { service, repo } = setup();

    await expect(service.countOwnEvents(attendee)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(repo.countOwnEventsByTab).not.toHaveBeenCalled();
  });
});

describe("eventService.getEventOverview", () => {
  it("returns the event with its figures and what its page holds", async () => {
    const { service, repo, strapi } = setup();
    repo.getOverviewExtras.mockResolvedValue({
      hallNames: ["Hall 1", "Hall 2"],
      speakerCount: 2,
      sessionBookings: 40,
      seatedSessions: [],
    });
    strapi.findEventPageById.mockResolvedValue({
      documentId: "doc-1",
      tagline: null,
      about: [paragraph("About the forum")],
      venueGuide: [],
      coverImage: {
        id: 9,
        url: "http://cms.test/9.jpg",
        alt: null,
        width: 1,
        height: 1,
      },
      gallery: [],
      highlights: [],
      faqs: [],
      seo: { metaTitle: null, metaDescription: null },
    });

    const overview = await service.getEventOverview(eventId, organizer);

    expect(repo.getOverviewExtras).toHaveBeenCalledWith(eventId, venueId);
    expect(overview).toMatchObject({
      event: { id: eventId, title: "Fintech Product Forum", status: "draft" },
      content: { hasDescription: true, hasBanner: true },
      hallCount: 2,
      hallNames: ["Hall 1", "Hall 2"],
      speakerCount: 2,
      sessionBookings: 40,
      publishedAt: null,
    });
    expect(() => eventOverviewSchema.parse(overview)).not.toThrow();
  });

  it("says the description and banner are missing for an empty page", async () => {
    const { service } = setup();

    const overview = await service.getEventOverview(eventId, organizer);

    expect(overview.content).toEqual({
      hasDescription: false,
      hasBanner: false,
    });
  });

  it("does not count a description made only of blank paragraphs", async () => {
    const { service, strapi } = setup();
    strapi.findEventPageById.mockResolvedValue({
      documentId: "doc-1",
      tagline: null,
      about: [paragraph("   ")],
      venueGuide: [],
      coverImage: null,
      gallery: [],
      highlights: [],
      faqs: [],
      seo: { metaTitle: null, metaDescription: null },
    });

    const overview = await service.getEventOverview(eventId, organizer);

    expect(overview.content?.hasDescription).toBe(false);
  });

  it("does not call Strapi for an event with no page yet", async () => {
    const { service, repo, strapi } = setup();
    repo.findEventById.mockResolvedValue({ ...eventRef, cmsEventId: null });

    const overview = await service.getEventOverview(eventId, organizer);

    expect(strapi.findEventPageById).not.toHaveBeenCalled();
    expect(overview.content).toEqual({
      hasDescription: false,
      hasBanner: false,
    });
  });

  it("still loads when Strapi is down: the content is unknown, not an error", async () => {
    const { service, strapi } = setup();
    strapi.findEventPageById.mockRejectedValue(
      new Error("connect ECONNREFUSED"),
    );

    const overview = await service.getEventOverview(eventId, organizer);

    expect(overview.content).toBeNull();
    expect(overview.event.id).toBe(eventId);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("works out sessions with seats left and lists the full ones", async () => {
    const { service, repo } = setup();
    repo.findManagedEvent.mockResolvedValue({
      ...managedRow,
      status: "published",
      sessionsTotal: 24,
      sessionsScheduled: 22,
    });
    repo.getOverviewExtras.mockResolvedValue({
      hallNames: ["Main Hall"],
      speakerCount: 14,
      sessionBookings: 1286,
      seatedSessions: [
        {
          id: "9d0e1f2a-3b4c-4d5e-8f60-718293a4b5c6",
          title: "Hands-on: Zod",
          seats: 60,
          booked: 60,
        },
        {
          id: "9d0e1f2a-3b4c-4d5e-8f60-718293a4b5c7",
          title: "Keynote",
          seats: 500,
          booked: 480,
        },
      ],
    });

    const overview = await service.getEventOverview(eventId, organizer);

    // 22 scheduled, 1 of them full.
    expect(overview.sessionsWithSeatsLeft).toBe(21);
    expect(overview.fullSessions).toEqual([
      {
        id: "9d0e1f2a-3b4c-4d5e-8f60-718293a4b5c6",
        title: "Hands-on: Zod",
        seats: 60,
      },
    ]);
  });

  it("gives the published date of a published event", async () => {
    const { service, repo } = setup();
    repo.findManagedEvent.mockResolvedValue({
      ...managedRow,
      status: "published",
      publishedAt: new Date("2026-09-12T08:00:00.000Z"),
    });

    const overview = await service.getEventOverview(eventId, organizer);

    expect(overview.publishedAt).toBe("2026-09-12T08:00:00.000Z");
  });

  it("answers 404 for somebody else's event, before any figure is read", async () => {
    const { service, repo } = setup();

    await expect(
      service.getEventOverview(eventId, otherOrganizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.findManagedEvent).not.toHaveBeenCalled();
    expect(repo.getOverviewExtras).not.toHaveBeenCalled();
  });

  it("does not mistake a user id for the owner: an event is owned by a profile id", async () => {
    const { service, repo } = setup();
    // A row still holding the organizer's USER id (the old format) is not theirs.
    repo.findEventById.mockResolvedValue({
      ...eventRef,
      organizerId: organizer.id,
    });

    await expect(
      service.getEventOverview(eventId, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.findManagedEvent).not.toHaveBeenCalled();
  });

  it("lets an admin open any event", async () => {
    const { service } = setup();

    await expect(
      service.getEventOverview(eventId, admin),
    ).resolves.toBeDefined();
  });

  it("answers 404 for an event that does not exist", async () => {
    const { service, repo } = setup();
    repo.findEventById.mockResolvedValue(null);

    await expect(
      service.getEventOverview(eventId, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("can show a cancelled event: reading is not editing", async () => {
    const { service, repo } = setup();
    repo.findEventById.mockResolvedValue({ ...eventRef, status: "cancelled" });
    repo.findManagedEvent.mockResolvedValue({
      ...managedRow,
      status: "cancelled",
    });

    const overview = await service.getEventOverview(eventId, organizer);

    expect(overview.event.status).toBe("cancelled");
  });
});

describe("eventService.updateEvent", () => {
  const body = (values: Record<string, unknown>) =>
    updateEventBodySchema.parse(values);
  const futureISO = (days: number) =>
    new Date(NOW.getTime() + days * 86_400_000).toISOString();

  it("changes only the fields that were sent", async () => {
    const { service, repo } = setup();

    const dto = await service.updateEvent(
      eventId,
      body({ title: "New title" }),
      organizer,
    );

    expect(repo.updateEvent).toHaveBeenCalledWith(eventId, {
      title: "New title",
    });
    expect(dto.title).toBe("New title");
    // The public link never changes with the title.
    expect(dto.slug).toBe("fintech-product-forum");
  });

  it("hides what the client has no business reading", async () => {
    const { service } = setup();

    const dto = await service.updateEvent(
      eventId,
      body({ title: "x y z" }),
      organizer,
    );

    expect(dto).not.toHaveProperty("organizerId");
    expect(dto).not.toHaveProperty("cmsEventId");
  });

  it("answers 404 for somebody else's event, before reading or writing it", async () => {
    const { service, repo } = setup();

    await expect(
      service.updateEvent(eventId, body({ title: "x y z" }), otherOrganizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.findEventRecord).not.toHaveBeenCalled();
    expect(repo.updateEvent).not.toHaveBeenCalled();
  });

  it("lets an admin edit any event", async () => {
    const { service, repo } = setup();

    await service.updateEvent(eventId, body({ title: "Admin edit" }), admin);

    expect(repo.updateEvent).toHaveBeenCalled();
  });

  it("refuses a user with no event permission", async () => {
    const { service } = setup();

    await expect(
      service.updateEvent(eventId, body({ title: "x y z" }), attendee),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses a cancelled event (409)", async () => {
    const { service, repo } = setup();
    repo.findEventById.mockResolvedValue({ ...eventRef, status: "cancelled" });

    const error = await service
      .updateEvent(eventId, body({ title: "x y z" }), organizer)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe("EVENT_CANCELLED");
    expect(repo.updateEvent).not.toHaveBeenCalled();
  });

  it("refuses a completed event: published and already over (409)", async () => {
    const { service, repo } = setup();
    repo.findEventRecord.mockResolvedValue({
      ...eventRecord,
      status: "published",
      startAt: new Date("2026-10-30T04:00:00.000Z"),
      endAt: new Date("2026-10-30T12:00:00.000Z"),
    });

    const error = await service
      .updateEvent(eventId, body({ title: "x y z" }), organizer)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe("EVENT_ENDED");
  });

  describe("dates", () => {
    it("rejects an end that is not after the start the event already has", async () => {
      const { service, repo } = setup();

      const error = await service
        .updateEvent(
          eventId,
          // The event starts on 12 Dec; this end is before that.
          body({ endAt: "2026-12-11T10:00:00+05:30" }),
          organizer,
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details).toEqual({
        fieldErrors: { endAt: ["The event must end after it starts"] },
      });
      expect(repo.updateEvent).not.toHaveBeenCalled();
    });

    it("rejects a start moved into the past", async () => {
      const { service } = setup();

      const error = await service
        .updateEvent(
          eventId,
          body({ startAt: "2026-10-01T09:00:00+05:30" }),
          organizer,
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details).toEqual({
        fieldErrors: { startAt: ["The event must start in the future"] },
      });
    });

    it("lets an event that is already running keep its start while other things change", async () => {
      const { service, repo } = setup();
      repo.findEventRecord.mockResolvedValue({
        ...eventRecord,
        status: "published",
        startAt: new Date("2026-11-02T04:00:00.000Z"),
        endAt: new Date("2026-11-04T12:00:00.000Z"),
      });

      await expect(
        service.updateEvent(
          eventId,
          // The same start it already has (in the past) is not "moving the start".
          body({ startAt: "2026-11-02T04:00:00Z", capacity: 300 }),
          organizer,
        ),
      ).resolves.toBeDefined();
    });

    it("saves new dates when no session falls outside them", async () => {
      const { service, repo } = setup();
      const startAt = futureISO(60);
      const endAt = futureISO(61);

      await service.updateEvent(eventId, body({ startAt, endAt }), organizer);

      expect(repo.countSessionsOutside).toHaveBeenCalledWith(
        eventId,
        new Date(startAt),
        new Date(endAt),
      );
      expect(repo.updateEvent).toHaveBeenCalledWith(eventId, {
        startAt: new Date(startAt),
        endAt: new Date(endAt),
      });
    });

    it("refuses new dates that leave sessions outside (409)", async () => {
      const { service, repo } = setup();
      repo.countSessionsOutside.mockResolvedValue(2);

      const error = await service
        .updateEvent(
          eventId,
          body({ startAt: futureISO(60), endAt: futureISO(61) }),
          organizer,
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe("SESSIONS_OUTSIDE_EVENT");
      expect(repo.updateEvent).not.toHaveBeenCalled();
    });

    it("does not look at the sessions when the dates did not change", async () => {
      const { service, repo } = setup();

      await service.updateEvent(
        eventId,
        body({ title: "New title" }),
        organizer,
      );

      expect(repo.countSessionsOutside).not.toHaveBeenCalled();
    });

    it("refuses a start that moves before the registration is set to close (409)", async () => {
      const { service, repo } = setup();
      repo.findEventRecord.mockResolvedValue({
        ...eventRecord,
        registrationClosesAt: new Date("2026-12-11T00:00:00.000Z"),
      });

      const error = await service
        .updateEvent(eventId, body({ startAt: futureISO(30) }), organizer)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe(
        "REGISTRATION_CLOSES_AFTER_START",
      );
    });
  });

  describe("capacity and price", () => {
    it("does not count registrations when neither is touched", async () => {
      const { service, repo } = setup();

      await service.updateEvent(
        eventId,
        body({ title: "New title" }),
        organizer,
      );

      expect(repo.countRegistered).not.toHaveBeenCalled();
    });

    it("refuses a capacity below the people already registered (409)", async () => {
      const { service, repo } = setup();
      repo.countRegistered.mockResolvedValue(120);

      const error = await service
        .updateEvent(eventId, body({ capacity: 100 }), organizer)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe("CAPACITY_BELOW_REGISTERED");
      expect((error as ConflictError).message).toContain("120");
    });

    it("accepts a capacity equal to the registrations", async () => {
      const { service, repo } = setup();
      repo.countRegistered.mockResolvedValue(120);

      await service.updateEvent(eventId, body({ capacity: 120 }), organizer);

      expect(repo.updateEvent).toHaveBeenCalledWith(eventId, { capacity: 120 });
    });

    it("removes the limit with null, without counting anyone", async () => {
      const { service, repo } = setup();

      await service.updateEvent(eventId, body({ capacity: null }), organizer);

      expect(repo.updateEvent).toHaveBeenCalledWith(eventId, {
        capacity: null,
      });
      expect(repo.countRegistered).not.toHaveBeenCalled();
    });

    it("locks the ticket price once someone registered (409)", async () => {
      const { service, repo } = setup();
      repo.countRegistered.mockResolvedValue(3);

      const error = await service
        .updateEvent(eventId, body({ ticketPrice: 50000 }), organizer)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe("EVENT_HAS_REGISTRATIONS");
      expect(repo.updateEvent).not.toHaveBeenCalled();
    });

    it("lets the price change before anyone registered", async () => {
      const { service, repo } = setup();

      await service.updateEvent(
        eventId,
        body({ ticketPrice: 50000 }),
        organizer,
      );

      expect(repo.updateEvent).toHaveBeenCalledWith(eventId, {
        ticketPrice: 50000,
      });
    });

    it("lets the same price through even with registrations", async () => {
      const { service, repo } = setup();
      repo.countRegistered.mockResolvedValue(3);

      await expect(
        service.updateEvent(
          eventId,
          // The event's price is 0: sending 0 again changes nothing.
          body({ ticketPrice: 0, title: "New title" }),
          organizer,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe("venue", () => {
    const otherVenueId = "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d99";

    it("moves the event to another venue and takes that venue's time zone", async () => {
      const { service, repo } = setup();
      repo.findVenue.mockResolvedValue({ ...venue, id: otherVenueId });

      await service.updateEvent(
        eventId,
        body({ venueId: otherVenueId }),
        organizer,
      );

      expect(repo.updateEvent).toHaveBeenCalledWith(eventId, {
        venueId: otherVenueId,
        timezone: "America/New_York",
      });
    });

    it("answers 404 for a venue that does not exist", async () => {
      const { service, repo } = setup();
      repo.findVenue.mockResolvedValue(null);

      await expect(
        service.updateEvent(
          eventId,
          body({ venueId: otherVenueId }),
          organizer,
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.updateEvent).not.toHaveBeenCalled();
    });

    it("refuses an inactive venue (409 VENUE_INACTIVE)", async () => {
      const { service, repo } = setup();
      repo.findVenue.mockResolvedValue({
        ...venue,
        id: otherVenueId,
        isActive: false,
      });

      const error = await service
        .updateEvent(eventId, body({ venueId: otherVenueId }), organizer)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe("VENUE_INACTIVE");
    });

    it("locks the venue once someone registered (409)", async () => {
      const { service, repo } = setup();
      repo.countRegistered.mockResolvedValue(1);

      const error = await service
        .updateEvent(eventId, body({ venueId: otherVenueId }), organizer)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe("EVENT_HAS_REGISTRATIONS");
      expect(repo.findVenue).not.toHaveBeenCalled();
    });

    it("refuses a venue change that would strand sessions in the old venue's halls (409)", async () => {
      const { service, repo } = setup();
      repo.findVenue.mockResolvedValue({ ...venue, id: otherVenueId });
      repo.countSessionsInOtherVenue.mockResolvedValue(3);

      const error = await service
        .updateEvent(eventId, body({ venueId: otherVenueId }), organizer)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe("SESSIONS_USE_OTHER_VENUE");
      expect(repo.countSessionsInOtherVenue).toHaveBeenCalledWith(
        eventId,
        otherVenueId,
      );
    });

    it("clears the venue with null, keeping the time zone", async () => {
      const { service, repo } = setup();

      await service.updateEvent(eventId, body({ venueId: null }), organizer);

      expect(repo.countSessionsInOtherVenue).toHaveBeenCalledWith(
        eventId,
        null,
      );
      expect(repo.updateEvent).toHaveBeenCalledWith(eventId, { venueId: null });
    });

    it("does nothing about the venue when the same one is sent", async () => {
      const { service, repo } = setup();

      await service.updateEvent(
        eventId,
        body({ venueId, title: "New title" }),
        organizer,
      );

      expect(repo.findVenue).not.toHaveBeenCalled();
      expect(repo.countSessionsInOtherVenue).not.toHaveBeenCalled();
      // Sent as it was: it is written again, harmlessly, with no time zone change.
      expect(repo.updateEvent).toHaveBeenCalledWith(eventId, {
        venueId,
        title: "New title",
      });
    });
  });

  it("says so when the event was cancelled while the organizer was editing (409)", async () => {
    const { service, repo } = setup();
    // The UPDATE is conditional on the status: no row means it changed in the meantime.
    repo.updateEvent.mockResolvedValue(null);

    const error = await service
      .updateEvent(eventId, body({ title: "New title" }), organizer)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe("EVENT_CHANGED");
  });
});

function setup() {
  return setupEventService();
}
