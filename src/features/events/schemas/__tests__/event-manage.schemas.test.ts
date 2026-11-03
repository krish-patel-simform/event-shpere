import {
  eventOverviewSchema,
  eventTabCountsSchema,
  managedEventSchema,
  myEventListQuerySchema,
} from "../event-manage.schemas";

const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";

const event = {
  id: eventId,
  slug: "fintech-product-forum",
  title: "Fintech Product Forum",
  status: "draft",
  startAt: "2026-12-12T04:00:00.000Z",
  endAt: "2026-12-12T12:00:00.000Z",
  timezone: "Asia/Kolkata",
  venue: {
    id: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    name: "Hotel Orchid",
    city: "Pune",
    state: "Maharashtra",
  },
  capacity: 250,
  registered: 0,
  cancelledRegistrations: 0,
  sessions: { total: 2, scheduled: 0, cancelled: 0 },
  ticketPrice: 0,
};

describe("myEventListQuerySchema", () => {
  it("fills the defaults: first page of 10, every event, soonest first", () => {
    expect(myEventListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 10,
      status: "all",
      sort: "soonest",
    });
  });

  it("reads the numbers from the URL's text", () => {
    expect(
      myEventListQuerySchema.parse({ page: "3", pageSize: "25" }),
    ).toMatchObject({ page: 3, pageSize: 25 });
  });

  it("trims the search", () => {
    expect(myEventListQuerySchema.parse({ search: "  summit " }).search).toBe(
      "summit",
    );
  });

  it.each([
    ["page 0", { page: "0" }],
    ["a fractional page", { page: "1.5" }],
    ["a page size of 0", { pageSize: "0" }],
    ["a page size over 50", { pageSize: "51" }],
    ["an unknown status", { status: "deleted" }],
    ["an unknown sort", { sort: "random" }],
    ["a search over 100 characters", { search: "a".repeat(101) }],
  ])("rejects %s", (_label, query) => {
    expect(myEventListQuerySchema.safeParse(query).success).toBe(false);
  });

  it("accepts every tab", () => {
    for (const status of [
      "all",
      "draft",
      "published",
      "completed",
      "cancelled",
    ]) {
      expect(myEventListQuerySchema.parse({ status }).status).toBe(status);
    }
  });
});

describe("managedEventSchema", () => {
  it("accepts an event with a venue", () => {
    expect(managedEventSchema.safeParse(event).success).toBe(true);
  });

  it("accepts an event with no venue, no limit and a venue with no state", () => {
    expect(
      managedEventSchema.safeParse({ ...event, venue: null, capacity: null })
        .success,
    ).toBe(true);
    expect(
      managedEventSchema.safeParse({
        ...event,
        venue: { ...event.venue, state: null },
      }).success,
    ).toBe(true);
  });

  it("only knows the four statuses the organizer sees", () => {
    for (const status of ["draft", "published", "completed", "cancelled"]) {
      expect(managedEventSchema.safeParse({ ...event, status }).success).toBe(
        true,
      );
    }
    expect(
      managedEventSchema.safeParse({ ...event, status: "archived" }).success,
    ).toBe(false);
  });

  it("rejects a negative count or price", () => {
    expect(
      managedEventSchema.safeParse({ ...event, registered: -1 }).success,
    ).toBe(false);
    expect(
      managedEventSchema.safeParse({ ...event, ticketPrice: -5 }).success,
    ).toBe(false);
  });

  it("rejects a date that is not an ISO string", () => {
    expect(
      managedEventSchema.safeParse({ ...event, startAt: "12 Dec 2026" })
        .success,
    ).toBe(false);
  });
});

describe("eventTabCountsSchema", () => {
  it("needs a count for every tab", () => {
    const counts = {
      all: 5,
      draft: 1,
      published: 2,
      completed: 1,
      cancelled: 1,
    };

    expect(eventTabCountsSchema.safeParse(counts).success).toBe(true);
    expect(
      eventTabCountsSchema.safeParse({ ...counts, draft: undefined }).success,
    ).toBe(false);
  });
});

describe("eventOverviewSchema", () => {
  const overview = {
    event,
    content: { hasDescription: false, hasBanner: false },
    hallCount: 2,
    hallNames: ["Hall 1", "Hall 2"],
    speakerCount: 2,
    sessionBookings: 0,
    sessionsWithSeatsLeft: 0,
    fullSessions: [],
    publishedAt: null,
  };

  it("accepts an overview", () => {
    expect(eventOverviewSchema.safeParse(overview).success).toBe(true);
  });

  it("accepts unknown content (the CMS did not answer) and a published date", () => {
    expect(
      eventOverviewSchema.safeParse({
        ...overview,
        content: null,
        publishedAt: "2026-09-12T08:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("describes a full session by id, title and seats", () => {
    expect(
      eventOverviewSchema.safeParse({
        ...overview,
        fullSessions: [{ id: eventId, title: "Hands-on: Zod", seats: 60 }],
      }).success,
    ).toBe(true);
    expect(
      eventOverviewSchema.safeParse({
        ...overview,
        fullSessions: [{ id: "not-a-uuid", title: "x", seats: 60 }],
      }).success,
    ).toBe(false);
  });
});
