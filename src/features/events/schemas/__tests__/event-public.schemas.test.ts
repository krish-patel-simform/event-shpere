import {
  publicEventDetailSchema,
  publicEventListItemSchema,
  publicEventListQuerySchema,
  publicEventSlugParam,
} from "../event-public.schemas";

describe("publicEventListQuerySchema", () => {
  it("defaults to the first page of 12 upcoming events, soonest first", () => {
    expect(publicEventListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 12,
      when: "upcoming",
      sort: "soonest",
    });
  });

  it("reads numbers from the URL's text", () => {
    const query = publicEventListQuerySchema.parse({
      page: "3",
      pageSize: "20",
    });

    expect(query.page).toBe(3);
    expect(query.pageSize).toBe(20);
  });

  it.each([
    ["page 0", { page: "0" }],
    ["page 1.5", { page: "1.5" }],
    ["page size 0", { pageSize: "0" }],
    ["page size over 50", { pageSize: "51" }],
    ["an unknown sort", { sort: "random" }],
    ["an unknown price", { price: "cheap" }],
    ["an unknown when", { when: "someday" }],
    ["a search over 100 characters", { search: "a".repeat(101) }],
  ])("refuses %s", (_name, input) => {
    expect(publicEventListQuerySchema.safeParse(input).success).toBe(false);
  });

  it("trims the search text", () => {
    expect(
      publicEventListQuerySchema.parse({ search: "  tech  " }).search,
    ).toBe("tech");
  });

  it("accepts every sort, price and when it names", () => {
    for (const sort of [
      "soonest",
      "latest",
      "price_asc",
      "price_desc",
      "popular",
    ]) {
      expect(publicEventListQuerySchema.safeParse({ sort }).success).toBe(true);
    }
    for (const price of ["free", "paid"]) {
      expect(publicEventListQuerySchema.safeParse({ price }).success).toBe(
        true,
      );
    }
    for (const when of ["upcoming", "past"]) {
      expect(publicEventListQuerySchema.safeParse({ when }).success).toBe(true);
    }
  });
});

describe("publicEventSlugParam", () => {
  it("accepts a slug as the server makes it", () => {
    expect(
      publicEventSlugParam.safeParse({ slug: "tech-conf-2026-3f9a1c" }).success,
    ).toBe(true);
  });

  it.each(["", "Tech Conf", "tech_conf", "-x", "x-", "a/b", "a..b"])(
    "refuses %j before it reaches the database",
    (slug) => {
      expect(publicEventSlugParam.safeParse({ slug }).success).toBe(false);
    },
  );
});

describe("what the public contract leaves out", () => {
  const listItem = {
    slug: "tech-conf",
    title: "Tech Conf",
    startAt: "2026-12-12T04:00:00.000Z",
    endAt: "2026-12-12T12:00:00.000Z",
    timezone: "Asia/Kolkata",
    venue: { name: "Hotel Orchid", city: "Pune", state: "Maharashtra" },
    ticketPrice: 0,
    seatsLeft: 10,
    tagline: null,
    coverImage: null,
  };

  it("drops fields that are not part of it, so they can never leak through the schema", () => {
    const parsed = publicEventListItemSchema.parse({
      ...listItem,
      id: "e1",
      capacity: 100,
      registered: 90,
      organizerId: "o1",
      cmsEventId: "doc-1",
    });

    expect(Object.keys(parsed).sort()).toEqual(Object.keys(listItem).sort());
  });

  it("shows a cover without its Strapi file id", () => {
    const parsed = publicEventListItemSchema.parse({
      ...listItem,
      coverImage: {
        id: 9,
        url: "http://cms.test/c.jpg",
        alt: null,
        width: 10,
        height: 5,
      },
    });

    expect(parsed.coverImage).toEqual({
      url: "http://cms.test/c.jpg",
      alt: null,
      width: 10,
      height: 5,
    });
  });

  it("only knows the two public statuses: a draft can never be described", () => {
    const base = {
      ...listItem,
      status: "published",
      venue: null,
      registrationOpensAt: null,
      registrationClosesAt: null,
      content: null,
      sessions: [],
    };

    expect(publicEventDetailSchema.safeParse(base).success).toBe(true);
    expect(
      publicEventDetailSchema.safeParse({ ...base, status: "cancelled" })
        .success,
    ).toBe(true);
    expect(
      publicEventDetailSchema.safeParse({ ...base, status: "draft" }).success,
    ).toBe(false);
  });
});
