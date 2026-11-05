import { NotFoundError } from "../../../../core/http/errors";
import type { CmsEventPage } from "../../../cms";
import {
  emptyPage,
  managedRow,
  NOW,
  setupEventService,
} from "../../__fixtures__/event-service";
import {
  publicEventDetailSchema,
  publicEventListItemSchema,
  publicEventListQuerySchema,
  publicEventListResponseSchema,
} from "../../schemas/event-public.schemas";
import type {
  ManagedEventRow,
  PublicEventRow,
  PublicSessionRow,
} from "../event.repository";

// Empty factories: the DB client, Strapi client and env are never loaded.
jest.mock("../event.repository", () => ({}));
jest.mock("../../../cms/server", () =>
  jest.requireActual("../../../cms/server/image-upload"),
);
jest.mock("../../../organizer/server", () => ({}));

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

const query = (overrides: Record<string, unknown> = {}) =>
  publicEventListQuerySchema.parse(overrides);

const paragraph = (text: string) => ({
  type: "paragraph",
  children: [{ type: "text", text }],
});

const media = {
  id: 9,
  url: "http://cms.test/uploads/cover.jpg",
  alt: "The hall",
  width: 1600,
  height: 900,
};

/** A published event row as the list query returns it. */
const row = (overrides: Partial<ManagedEventRow> = {}): ManagedEventRow => ({
  ...managedRow,
  id: "e-1",
  slug: "tech-conf-2026",
  title: "Tech Conf",
  status: "published",
  capacity: 250,
  registered: 100,
  cmsEventId: "doc-1",
  ...overrides,
});

const page = (overrides: Partial<CmsEventPage> = {}): CmsEventPage => ({
  ...emptyPage,
  documentId: "doc-1",
  ...overrides,
});

describe("eventService.listPublicEvents", () => {
  it("asks the repository for the page and filters the visitor chose, with the time now", async () => {
    const { service, repo } = setupEventService();

    await service.listPublicEvents(
      query({
        page: "3",
        pageSize: "10",
        search: "  tech ",
        price: "paid",
        when: "past",
        sort: "popular",
      }),
    );

    expect(repo.listPublicEvents).toHaveBeenCalledWith({
      search: "tech",
      price: "paid",
      when: "past",
      sort: "popular",
      now: NOW,
      limit: 10,
      offset: 20,
    });
  });

  it("treats a search of only spaces as no search", async () => {
    const { service, repo } = setupEventService();

    await service.listPublicEvents(query({ search: "   " }));

    expect(repo.listPublicEvents).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    );
  });

  it("answers with the page, and how many events match in all", async () => {
    const { service, repo } = setupEventService();
    repo.listPublicEvents.mockResolvedValue({ rows: [row()], total: 37 });

    const result = await service.listPublicEvents(
      query({ page: "2", pageSize: "12" }),
    );

    expect(result.meta).toEqual({ page: 2, pageSize: 12, total: 37 });
    expect(result.items).toHaveLength(1);
  });

  describe("the banner and tagline from the CMS", () => {
    it("reads the pages of the whole list in ONE call, by their document ids", async () => {
      const { service, repo, strapi } = setupEventService();
      repo.listPublicEvents.mockResolvedValue({
        rows: [
          row({ id: "e-1", cmsEventId: "doc-1" }),
          row({ id: "e-2", slug: "second", cmsEventId: "doc-2" }),
          row({ id: "e-3", slug: "third", cmsEventId: null }),
        ],
        total: 3,
      });

      await service.listPublicEvents(query());

      expect(strapi.findEventPagesByIds).toHaveBeenCalledTimes(1);
      // The event without a CMS page is not asked for.
      expect(strapi.findEventPagesByIds).toHaveBeenCalledWith([
        "doc-1",
        "doc-2",
      ]);
    });

    it("matches each page to its own event, whatever order the CMS answers in", async () => {
      const { service, repo, strapi } = setupEventService();
      repo.listPublicEvents.mockResolvedValue({
        rows: [
          row({ id: "e-1", slug: "first", cmsEventId: "doc-1" }),
          row({ id: "e-2", slug: "second", cmsEventId: "doc-2" }),
        ],
        total: 2,
      });
      strapi.findEventPagesByIds.mockResolvedValue([
        page({ documentId: "doc-2", tagline: "Second tagline" }),
        page({
          documentId: "doc-1",
          tagline: "First tagline",
          coverImage: media,
        }),
      ]);

      const { items } = await service.listPublicEvents(query());

      expect(items.map((item) => [item.slug, item.tagline])).toEqual([
        ["first", "First tagline"],
        ["second", "Second tagline"],
      ]);
      expect(items[0]?.coverImage).toEqual({
        url: media.url,
        alt: "The hall",
        width: 1600,
        height: 900,
      });
      expect(items[1]?.coverImage).toBeNull();
    });

    it("lists an event the CMS has no page for, without a banner", async () => {
      const { service, repo, strapi } = setupEventService();
      repo.listPublicEvents.mockResolvedValue({ rows: [row()], total: 1 });
      strapi.findEventPagesByIds.mockResolvedValue([]);

      const { items } = await service.listPublicEvents(query());

      expect(items[0]).toMatchObject({ tagline: null, coverImage: null });
    });

    it("still lists every event when the CMS fails, and logs why", async () => {
      const { service, repo, strapi } = setupEventService();
      repo.listPublicEvents.mockResolvedValue({
        rows: [row(), row({ id: "e-2", slug: "second", cmsEventId: "doc-2" })],
        total: 2,
      });
      strapi.findEventPagesByIds.mockRejectedValue(new Error("ECONNREFUSED"));

      const { items, meta } = await service.listPublicEvents(query());

      expect(items).toHaveLength(2);
      expect(items.every((item) => item.coverImage === null)).toBe(true);
      expect(meta.total).toBe(2);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("CMS content"),
        "ECONNREFUSED",
      );
    });
  });

  describe("what a card shows", () => {
    it("shows the venue, the price and the dates in the event's zone, and no ids", async () => {
      const { service, repo } = setupEventService();
      repo.listPublicEvents.mockResolvedValue({
        rows: [row({ ticketPrice: 49950 })],
        total: 1,
      });

      const { items } = await service.listPublicEvents(query());

      expect(items[0]).toMatchObject({
        slug: "tech-conf-2026",
        title: "Tech Conf",
        timezone: "Asia/Kolkata",
        ticketPrice: 49950,
        venue: { name: "Hotel Orchid", city: "Pune", state: "Maharashtra" },
      });
      expect(items[0]?.startAt).toBe(managedRow.startAt.toISOString());
    });

    it("has no venue for an event that has none", async () => {
      const { service, repo } = setupEventService();
      repo.listPublicEvents.mockResolvedValue({
        rows: [row({ venueId: null, venueName: null, venueCity: null })],
        total: 1,
      });

      const { items } = await service.listPublicEvents(query());

      expect(items[0]?.venue).toBeNull();
    });

    it.each([
      ["seats left of a limited event", 250, 100, 150],
      ["a full event", 100, 100, 0],
      ["more bookings than a lowered capacity (never below 0)", 100, 130, 0],
      ["an event with no limit", null, 500, null],
    ])("shows %s", async (_name, capacity, registered, expected) => {
      const { service, repo } = setupEventService();
      repo.listPublicEvents.mockResolvedValue({
        rows: [row({ capacity, registered })],
        total: 1,
      });

      const { items } = await service.listPublicEvents(query());

      expect(items[0]?.seatsLeft).toBe(expected);
    });

    it("leaves out everything the organizer's views hold", async () => {
      const { service, repo, strapi } = setupEventService();
      repo.listPublicEvents.mockResolvedValue({ rows: [row()], total: 1 });
      strapi.findEventPagesByIds.mockResolvedValue([
        page({ coverImage: media }),
      ]);

      const { items } = await service.listPublicEvents(query());
      const serialized = JSON.stringify(items);

      for (const secret of [
        '"id"',
        "organizer",
        "capacity",
        "registered",
        "cmsEventId",
        "doc-1",
        '"sessions"',
        "cancelledRegistrations",
        "publishedAt",
      ]) {
        expect(serialized).not.toContain(secret);
      }
      // The Strapi file id of the cover stays inside.
      expect(items[0]?.coverImage).not.toHaveProperty("id");
    });

    it("produces answers the public contract accepts", async () => {
      const { service, repo, strapi } = setupEventService();
      repo.listPublicEvents.mockResolvedValue({ rows: [row()], total: 1 });
      strapi.findEventPagesByIds.mockResolvedValue([
        page({ tagline: "Learn it all", coverImage: media }),
      ]);

      const { items } = await service.listPublicEvents(query());

      expect(publicEventListResponseSchema.safeParse(items).success).toBe(true);
      expect(publicEventListItemSchema.safeParse(items[0]).success).toBe(true);
    });
  });
});

//* The public page of one event

const detailRow = (
  overrides: Partial<PublicEventRow> = {},
): PublicEventRow => ({
  id: "e-1",
  slug: "tech-conf-2026",
  title: "Tech Conf",
  status: "published",
  startAt: new Date("2026-12-03T03:30:00.000Z"),
  endAt: new Date("2026-12-05T12:30:00.000Z"),
  timezone: "Asia/Kolkata",
  capacity: 250,
  ticketPrice: 150000,
  registrationOpensAt: new Date("2026-11-01T00:00:00.000Z"),
  registrationClosesAt: null,
  cmsEventId: "doc-1",
  registered: 40,
  venueName: "Hotel Orchid",
  venueAddressLine: "12 MG Road",
  venueCity: "Pune",
  venueState: "Maharashtra",
  venuePostalCode: "411001",
  ...overrides,
});

const sessionRow = (
  overrides: Partial<PublicSessionRow> = {},
): PublicSessionRow => ({
  id: "7c3d4e5f-6a7b-4c8d-ae9f-1a2b3c4d5e01",
  title: "Offline-first Event Apps",
  type: "talk",
  mode: "hybrid",
  startAt: new Date("2026-12-03T04:30:00.000Z"),
  endAt: new Date("2026-12-03T05:30:00.000Z"),
  hallName: "Hall A",
  price: 0,
  requiresRegistration: true,
  speakers: [
    {
      slug: "ananya-rao-3f9a1c",
      firstName: "Ananya",
      lastName: "Rao",
      role: "speaker",
    },
  ],
  ...overrides,
});

describe("eventService.getPublicEvent", () => {
  it("is a 404 for a link no visible event has, and reads nothing else", async () => {
    const { service, repo, strapi } = setupEventService();
    repo.findPublicEventBySlug.mockResolvedValue(null);

    await expect(service.getPublicEvent("nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repo.listPublicSessions).not.toHaveBeenCalled();
    expect(strapi.findEventPageById).not.toHaveBeenCalled();
  });

  it("looks the event up by its link, and its sessions by the event's id", async () => {
    const { service, repo } = setupEventService();
    repo.findPublicEventBySlug.mockResolvedValue(detailRow());

    await service.getPublicEvent("tech-conf-2026");

    expect(repo.findPublicEventBySlug).toHaveBeenCalledWith("tech-conf-2026");
    expect(repo.listPublicSessions).toHaveBeenCalledWith("e-1");
  });

  it("shows the facts, the venue's address, the written content and the sessions", async () => {
    const { service, repo, strapi } = setupEventService();
    repo.findPublicEventBySlug.mockResolvedValue(detailRow());
    repo.listPublicSessions.mockResolvedValue([sessionRow()]);
    strapi.findEventPageById.mockResolvedValue(
      page({
        tagline: "Learn it all",
        about: [paragraph("About the event")],
        venueGuide: [paragraph("Take the metro")],
        coverImage: media,
        gallery: [{ ...media, id: 10 }],
        highlights: [{ title: "Keynote", description: null }],
        faqs: [{ question: "Parking?", answer: [paragraph("Yes")] }],
        seo: { metaTitle: "Tech Conf", metaDescription: null },
      }),
    );

    const event = await service.getPublicEvent("tech-conf-2026");

    expect(event).toMatchObject({
      slug: "tech-conf-2026",
      title: "Tech Conf",
      status: "published",
      ticketPrice: 150000,
      seatsLeft: 210,
      registrationOpensAt: "2026-11-01T00:00:00.000Z",
      registrationClosesAt: null,
      venue: {
        name: "Hotel Orchid",
        addressLine: "12 MG Road",
        city: "Pune",
        state: "Maharashtra",
        postalCode: "411001",
      },
    });
    expect(event.content).toMatchObject({
      tagline: "Learn it all",
      about: "About the event",
      venueGuide: "Take the metro",
      highlights: [{ title: "Keynote", description: "" }],
      faqs: [{ question: "Parking?", answer: "Yes" }],
      seo: { metaTitle: "Tech Conf", metaDescription: null },
    });
    expect(event.content?.coverImage).toEqual({
      url: media.url,
      alt: "The hall",
      width: 1600,
      height: 900,
    });
    expect(event.content?.gallery).toHaveLength(1);
    expect(event.sessions).toHaveLength(1);
  });

  it("names each session's speakers, with the link to their page, and gives the hall's name", async () => {
    const { service, repo } = setupEventService();
    repo.findPublicEventBySlug.mockResolvedValue(detailRow());
    repo.listPublicSessions.mockResolvedValue([sessionRow()]);

    const { sessions } = await service.getPublicEvent("tech-conf-2026");

    expect(sessions[0]).toMatchObject({
      title: "Offline-first Event Apps",
      type: "talk",
      mode: "hybrid",
      hallName: "Hall A",
      price: 0,
      requiresRegistration: true,
      startAt: "2026-12-03T04:30:00.000Z",
      speakers: [
        { slug: "ananya-rao-3f9a1c", name: "Ananya Rao", role: "speaker" },
      ],
    });
  });

  it("shows a cancelled event, marked cancelled", async () => {
    const { service, repo } = setupEventService();
    repo.findPublicEventBySlug.mockResolvedValue(
      detailRow({ status: "cancelled" }),
    );

    const event = await service.getPublicEvent("tech-conf-2026");

    expect(event.status).toBe("cancelled");
  });

  it("has no venue for an event that has none", async () => {
    const { service, repo } = setupEventService();
    repo.findPublicEventBySlug.mockResolvedValue(
      detailRow({
        venueName: null,
        venueAddressLine: null,
        venueCity: null,
        venueState: null,
        venuePostalCode: null,
      }),
    );

    expect((await service.getPublicEvent("x")).venue).toBeNull();
  });

  describe("when the CMS cannot be read", () => {
    it("still shows the facts and the sessions, with content: null, and logs why", async () => {
      const { service, repo, strapi } = setupEventService();
      repo.findPublicEventBySlug.mockResolvedValue(detailRow());
      repo.listPublicSessions.mockResolvedValue([sessionRow()]);
      strapi.findEventPageById.mockRejectedValue(new Error("timeout"));

      const event = await service.getPublicEvent("tech-conf-2026");

      expect(event.content).toBeNull();
      expect(event.title).toBe("Tech Conf");
      expect(event.sessions).toHaveLength(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("CMS content"),
        "timeout",
      );
    });

    it("has content: null when the CMS has no page for the event", async () => {
      const { service, repo, strapi } = setupEventService();
      repo.findPublicEventBySlug.mockResolvedValue(detailRow());
      strapi.findEventPageById.mockResolvedValue(null);

      expect((await service.getPublicEvent("x")).content).toBeNull();
    });

    it("does not call the CMS for an event that was never linked to a page", async () => {
      const { service, repo, strapi } = setupEventService();
      repo.findPublicEventBySlug.mockResolvedValue(
        detailRow({ cmsEventId: null }),
      );

      const event = await service.getPublicEvent("x");

      expect(strapi.findEventPageById).not.toHaveBeenCalled();
      expect(event.content).toBeNull();
    });
  });

  describe("what the public never sees", () => {
    it("leaves out the ids, the capacity, the booking count, the CMS link, join links and the Strapi file ids", async () => {
      const { service, repo, strapi } = setupEventService();
      repo.findPublicEventBySlug.mockResolvedValue(detailRow());
      repo.listPublicSessions.mockResolvedValue([sessionRow()]);
      strapi.findEventPageById.mockResolvedValue(
        page({ coverImage: media, gallery: [media] }),
      );

      const event = await service.getPublicEvent("tech-conf-2026");
      const serialized = JSON.stringify(event);

      for (const secret of [
        '"capacity"',
        '"registered"',
        "cmsEventId",
        "doc-1",
        "onlineUrl",
        "organizer",
        "e-1",
      ]) {
        expect(serialized).not.toContain(secret);
      }
      expect(event.content?.coverImage).not.toHaveProperty("id");
      expect(event.content?.gallery[0]).not.toHaveProperty("id");
    });

    it("produces an answer the public contract accepts", async () => {
      const { service, repo, strapi } = setupEventService();
      repo.findPublicEventBySlug.mockResolvedValue(detailRow());
      repo.listPublicSessions.mockResolvedValue([sessionRow()]);
      strapi.findEventPageById.mockResolvedValue(page({ coverImage: media }));

      const event = await service.getPublicEvent("tech-conf-2026");

      expect(publicEventDetailSchema.safeParse(event).success).toBe(true);
    });
  });
});
