import {
  attendeeListMetaSchema,
  attendeeListQuerySchema,
  attendeeSchema,
} from "../attendees.schemas";

describe("attendeeListQuerySchema", () => {
  it("defaults to the first page of ten, every status, checked in or not, newest first", () => {
    expect(attendeeListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 10,
      status: "all",
      checkedIn: "all",
      sort: "newest",
    });
  });

  it("turns the query-string numbers into numbers and trims the search", () => {
    expect(
      attendeeListQuerySchema.parse({
        page: "2",
        pageSize: "25",
        search: "  priya  ",
      }),
    ).toMatchObject({ page: 2, pageSize: 25, search: "priya" });
  });

  it("accepts every status and checked-in filter", () => {
    for (const status of ["all", "registered", "cancelled"]) {
      expect(attendeeListQuerySchema.safeParse({ status }).success).toBe(true);
    }
    for (const checkedIn of ["all", "yes", "no"]) {
      expect(attendeeListQuerySchema.safeParse({ checkedIn }).success).toBe(
        true,
      );
    }
    for (const sort of ["newest", "oldest", "name", "checkedIn"]) {
      expect(attendeeListQuerySchema.safeParse({ sort }).success).toBe(true);
    }
  });

  it("takes no day by default, and accepts one event day", () => {
    expect(attendeeListQuerySchema.parse({}).date).toBeUndefined();
    expect(attendeeListQuerySchema.parse({ date: "2026-12-13" }).date).toBe(
      "2026-12-13",
    );
  });

  it.each([
    ["page 0", { page: "0" }],
    ["page size 0", { pageSize: "0" }],
    ["page size over 50", { pageSize: "51" }],
    ["an unknown status", { status: "pending_payment" }],
    ["an unknown checked-in value", { checkedIn: "maybe" }],
    ["an unknown sort", { sort: "random" }],
    ["a date that is not a date", { date: "tomorrow" }],
    ["a date with a time", { date: "2026-12-13T10:00:00Z" }],
    ["an impossible date", { date: "2026-13-45" }],
    ["a search over 100 characters", { search: "x".repeat(101) }],
  ])("rejects %s", (_name, query) => {
    expect(attendeeListQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("attendeeSchema", () => {
  const valid = {
    registrationId: "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f",
    firstName: "Priya",
    lastName: "Shah",
    email: "priya@example.com",
    ticketCode: "ESEVT7K3Q9P",
    status: "registered",
    registeredAt: "2026-11-01T08:00:00.000Z",
    checkedInAt: null,
    checkedInBy: null,
    checkInMethod: null,
  };

  it("accepts an attendee who has not checked in and one who has", () => {
    expect(attendeeSchema.safeParse(valid).success).toBe(true);
    expect(
      attendeeSchema.safeParse({
        ...valid,
        checkedInAt: "2026-12-12T04:30:00.000Z",
        checkedInBy: { firstName: "Omkar", lastName: "Patil" },
        checkInMethod: "manual",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown check-in method and a checker without a name", () => {
    expect(
      attendeeSchema.safeParse({ ...valid, checkInMethod: "telepathy" })
        .success,
    ).toBe(false);
    expect(
      attendeeSchema.safeParse({
        ...valid,
        checkedInBy: { firstName: "Omkar" },
      }).success,
    ).toBe(false);
  });

  it("rejects a bad id, an unknown status and a date that is not ISO", () => {
    expect(
      attendeeSchema.safeParse({ ...valid, registrationId: "nope" }).success,
    ).toBe(false);
    expect(
      attendeeSchema.safeParse({ ...valid, status: "pending_payment" }).success,
    ).toBe(false);
    expect(
      attendeeSchema.safeParse({ ...valid, registeredAt: "yesterday" }).success,
    ).toBe(false);
  });
});

describe("attendeeListMetaSchema", () => {
  it("accepts the paging fields with the event's counts and the door's setting", () => {
    expect(
      attendeeListMetaSchema.safeParse({
        page: 1,
        pageSize: 10,
        total: 0,
        counts: { registered: 0, cancelled: 0, checkedIn: 0, pending: 0 },
        checkInOpensHoursBefore: 6,
      }).success,
    ).toBe(true);
  });

  it("needs the door's setting (the screen greys out closed days with it)", () => {
    expect(
      attendeeListMetaSchema.safeParse({
        page: 1,
        pageSize: 10,
        total: 0,
        counts: { registered: 0, cancelled: 0, checkedIn: 0, pending: 0 },
      }).success,
    ).toBe(false);
  });

  it("rejects counts without the pending number", () => {
    expect(
      attendeeListMetaSchema.safeParse({
        page: 1,
        pageSize: 10,
        total: 0,
        counts: { registered: 0, cancelled: 0, checkedIn: 0 },
      }).success,
    ).toBe(false);
  });

  it("rejects negative counts", () => {
    expect(
      attendeeListMetaSchema.safeParse({
        page: 1,
        pageSize: 10,
        total: 0,
        counts: { registered: -1, cancelled: 0, checkedIn: 0, pending: 0 },
      }).success,
    ).toBe(false);
  });
});
