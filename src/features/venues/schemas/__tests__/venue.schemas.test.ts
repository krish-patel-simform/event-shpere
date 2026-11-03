import {
  createVenueBodySchema,
  setHallsStatusBodySchema,
  setVenueStatusBodySchema,
  venueListQuerySchema,
} from "../venue.schemas";

const validBody = {
  name: "GIFT City Convention Centre",
  addressLine: "Block 12, Zone 1, GIFT City",
  city: "Gandhinagar",
  state: "Gujarat",
  halls: [
    { name: "Hall A", capacity: 200 },
    { name: "Hall B", capacity: 80 },
  ],
};

describe("createVenueBodySchema", () => {
  it("needs a state name, trimmed, and refuses a blank one", () => {
    const { state, ...withoutState } = validBody;

    expect(state).toBe("Gujarat");
    expect(createVenueBodySchema.safeParse(withoutState).success).toBe(false);
    expect(
      createVenueBodySchema.safeParse({ ...validBody, state: "  " }).success,
    ).toBe(false);
    expect(
      createVenueBodySchema.parse({ ...validBody, state: " Gujarat " }).state,
    ).toBe("Gujarat");
  });

  it("accepts a valid body and fills the country and time zone defaults", () => {
    const result = createVenueBodySchema.parse(validBody);

    expect(result.country).toBe("IN");
    expect(result.timezone).toBe("Asia/Kolkata");
    expect(result.halls).toHaveLength(2);
  });

  it("trims text and uppercases the country code", () => {
    const result = createVenueBodySchema.parse({
      ...validBody,
      name: "  Expo Hall  ",
      country: " us ",
    });

    expect(result.name).toBe("Expo Hall");
    expect(result.country).toBe("US");
  });

  it("rejects an unknown time zone", () => {
    const result = createVenueBodySchema.safeParse({
      ...validBody,
      timezone: "Mars/Olympus",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a country that is not a 2-letter code", () => {
    const result = createVenueBodySchema.safeParse({
      ...validBody,
      country: "India",
    });

    expect(result.success).toBe(false);
  });

  it("rejects latitude or longitude out of range", () => {
    expect(
      createVenueBodySchema.safeParse({
        ...validBody,
        latitude: 91,
        longitude: 72,
      }).success,
    ).toBe(false);
    expect(
      createVenueBodySchema.safeParse({
        ...validBody,
        latitude: 23,
        longitude: -181,
      }).success,
    ).toBe(false);
  });

  it("rejects latitude without longitude", () => {
    const result = createVenueBodySchema.safeParse({
      ...validBody,
      latitude: 23.16,
    });

    expect(result.success).toBe(false);
  });

  it("accepts both coordinates together", () => {
    const result = createVenueBodySchema.safeParse({
      ...validBody,
      latitude: 23.16,
      longitude: 72.68,
    });

    expect(result.success).toBe(true);
  });

  it("requires at least one hall", () => {
    const result = createVenueBodySchema.safeParse({ ...validBody, halls: [] });

    expect(result.success).toBe(false);
  });

  it("rejects a hall capacity of 0 or a fraction", () => {
    for (const capacity of [0, -5, 1.5]) {
      const result = createVenueBodySchema.safeParse({
        ...validBody,
        halls: [{ name: "Hall A", capacity }],
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects the same hall name twice, ignoring case, and points at the repeat", () => {
    const result = createVenueBodySchema.safeParse({
      ...validBody,
      halls: [
        { name: "Hall A", capacity: 100 },
        { name: "hall a ", capacity: 50 },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["halls", 1, "name"]);
    }
  });
});

describe("setVenueStatusBodySchema", () => {
  it("defaults activateHalls to none, so activating a venue activates none of its halls", () => {
    expect(setVenueStatusBodySchema.parse({ isActive: true })).toEqual({
      isActive: true,
      activateHalls: "none",
    });
  });

  it("accepts activateHalls: all and rejects other values", () => {
    expect(
      setVenueStatusBodySchema.safeParse({
        isActive: true,
        activateHalls: "all",
      }).success,
    ).toBe(true);
    expect(
      setVenueStatusBodySchema.safeParse({
        isActive: true,
        activateHalls: "some",
      }).success,
    ).toBe(false);
  });

  it("requires isActive to be a boolean", () => {
    expect(
      setVenueStatusBodySchema.safeParse({ isActive: "yes" }).success,
    ).toBe(false);
  });
});

describe("setHallsStatusBodySchema", () => {
  const hallA = "a0000000-0000-4000-8000-000000000001";
  const hallB = "b0000000-0000-4000-8000-000000000002";

  it("accepts 'all' or a list of hall ids", () => {
    expect(
      setHallsStatusBodySchema.safeParse({ isActive: true, halls: "all" })
        .success,
    ).toBe(true);
    expect(
      setHallsStatusBodySchema.safeParse({
        isActive: false,
        halls: [hallA, hallB],
      }).success,
    ).toBe(true);
  });

  it("rejects an empty list, a repeated id, a non-uuid and any other string", () => {
    for (const halls of [[], [hallA, hallA], ["not-a-uuid"], "some"]) {
      expect(
        setHallsStatusBodySchema.safeParse({ isActive: true, halls }).success,
      ).toBe(false);
    }
  });
});

describe("venueListQuerySchema", () => {
  it("needs nothing: the list defaults to page 1, 10 per page, sorted by name", () => {
    expect(venueListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 10,
      sort: "name",
    });
  });

  it("reads the numbers from the query string text and keeps the filters", () => {
    expect(
      venueListQuerySchema.parse({
        page: "2",
        pageSize: "25",
        search: "  pune ",
        status: "inactive",
        state: " Gujarat ",
        sort: "halls",
      }),
    ).toEqual({
      page: 2,
      pageSize: 25,
      search: "pune",
      status: "inactive",
      state: "Gujarat",
      sort: "halls",
    });
  });

  it("rejects a status or sort that does not exist, and paging out of range", () => {
    for (const query of [
      { status: "closed" },
      { sort: "price" },
      { page: "0" },
      { pageSize: "0" },
      { pageSize: "51" },
      { page: "abc" },
      { search: "x".repeat(101) },
    ]) {
      expect(venueListQuerySchema.safeParse(query).success).toBe(false);
    }
  });
});
