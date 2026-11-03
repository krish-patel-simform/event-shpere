import {
  createEventBodySchema,
  updateEventBodySchema,
} from "../events.schemas";

const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000).toISOString();

const validBody = () => ({
  title: "Tech Conf 2026",
  startAt: hoursFromNow(48),
  endAt: hoursFromNow(56),
});

/** The paths of the issues a body produces, e.g. ["endAt"]. */
function issuePaths(body: unknown): string[] {
  const result = createEventBodySchema.safeParse(body);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."));
}

describe("createEventBodySchema", () => {
  it("accepts the minimum body, turns dates into Dates and fills the defaults", () => {
    const parsed = createEventBodySchema.parse(validBody());

    expect(parsed.startAt).toBeInstanceOf(Date);
    expect(parsed.endAt).toBeInstanceOf(Date);
    expect(parsed.ticketPrice).toBe(0);
    expect(parsed.currency).toBe("INR");
    expect(parsed.timezone).toBeUndefined();
    expect(parsed.venueId).toBeUndefined();
  });

  it("drops fields the client must never set", () => {
    const parsed = createEventBodySchema.parse({
      ...validBody(),
      status: "published",
      organizerId: "5d1c3a4b-7e8f-4a1b-9c2d-3e4f5a6b7c8d",
      slug: "mine",
      publishedAt: hoursFromNow(1),
      cmsEventId: "doc-1",
    });

    expect(Object.keys(parsed)).not.toEqual(
      expect.arrayContaining(["status", "organizerId", "slug", "cmsEventId"]),
    );
  });

  it("normalises the currency", () => {
    const parsed = createEventBodySchema.parse({
      ...validBody(),
      currency: " usd ",
    });
    expect(parsed.currency).toBe("USD");
  });

  it.each([
    ["a date without an offset", { startAt: "2030-01-01T10:00:00" }, "startAt"],
    ["a title that is too short", { title: "ab" }, "title"],
    ["a capacity of 0", { capacity: 0 }, "capacity"],
    ["a fractional capacity", { capacity: 1.5 }, "capacity"],
    ["a negative price", { ticketPrice: -1 }, "ticketPrice"],
    ["a currency that is not 3 letters", { currency: "RUPEE" }, "currency"],
    ["an unknown time zone", { timezone: "Mars/Olympus" }, "timezone"],
    ["a venue id that is not a uuid", { venueId: "123" }, "venueId"],
  ])("rejects %s", (_label, override, path) => {
    expect(issuePaths({ ...validBody(), ...override })).toContain(path);
  });

  it("rejects a start in the past", () => {
    expect(
      issuePaths({
        ...validBody(),
        startAt: hoursFromNow(-5),
        endAt: hoursFromNow(5),
      }),
    ).toContain("startAt");
  });

  it("rejects an end that is not after the start", () => {
    expect(issuePaths({ ...validBody(), endAt: hoursFromNow(48) })).toContain(
      "endAt",
    );
    expect(issuePaths({ ...validBody(), endAt: hoursFromNow(40) })).toContain(
      "endAt",
    );
  });

  it("rejects registration that closes before it opens", () => {
    expect(
      issuePaths({
        ...validBody(),
        registrationOpensAt: hoursFromNow(10),
        registrationClosesAt: hoursFromNow(5),
      }),
    ).toContain("registrationClosesAt");
  });

  it("rejects registration that closes after the event starts", () => {
    expect(
      issuePaths({
        ...validBody(),
        registrationClosesAt: hoursFromNow(50),
      }),
    ).toContain("registrationClosesAt");
  });

  it("accepts a valid registration window and a time zone", () => {
    const parsed = createEventBodySchema.parse({
      ...validBody(),
      timezone: "Asia/Kolkata",
      registrationOpensAt: hoursFromNow(1),
      registrationClosesAt: hoursFromNow(40),
      capacity: 100,
      ticketPrice: 150000,
    });
    expect(parsed.capacity).toBe(100);
    expect(parsed.ticketPrice).toBe(150000);
  });
});

describe("updateEventBodySchema", () => {
  const venueId = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
  const paths = (body: unknown): string[] => {
    const result = updateEventBodySchema.safeParse(body);
    return result.success
      ? []
      : result.error.issues.map((issue) => issue.path.join("."));
  };

  it("accepts a body with just one field", () => {
    expect(
      updateEventBodySchema.safeParse({ title: "New title" }).success,
    ).toBe(true);
  });

  it("rejects an empty body, and a body of only unknown fields", () => {
    expect(updateEventBodySchema.safeParse({}).success).toBe(false);
    // Unknown keys are dropped, so nothing is left to change.
    expect(
      updateEventBodySchema.safeParse({ status: "published", slug: "mine" })
        .success,
    ).toBe(false);
  });

  it("drops fields the client must never set", () => {
    const parsed = updateEventBodySchema.parse({
      title: "New title",
      status: "published",
      organizerId: "5d1c3a4b-7e8f-4a1b-9c2d-3e4f5a6b7c8d",
      slug: "mine",
      cmsEventId: "doc-1",
      currency: "USD",
    });

    expect(Object.keys(parsed)).toEqual(["title"]);
  });

  it("turns dates into Dates", () => {
    const parsed = updateEventBodySchema.parse({
      startAt: "2026-12-12T09:30:00+05:30",
      endAt: "2026-12-12T17:30:00+05:30",
    });

    expect(parsed.startAt).toBeInstanceOf(Date);
    expect(parsed.startAt?.toISOString()).toBe("2026-12-12T04:00:00.000Z");
  });

  it("clears the venue and the capacity with null", () => {
    const parsed = updateEventBodySchema.parse({
      venueId: null,
      capacity: null,
    });

    expect(parsed).toEqual({ venueId: null, capacity: null });
  });

  it("accepts a venue and a free price", () => {
    expect(updateEventBodySchema.parse({ venueId, ticketPrice: 0 })).toEqual({
      venueId,
      ticketPrice: 0,
    });
  });

  it("checks the two dates against each other when both are sent", () => {
    expect(
      paths({
        startAt: "2026-12-12T17:00:00+05:30",
        endAt: "2026-12-12T09:00:00+05:30",
      }),
    ).toContain("endAt");
  });

  it("leaves one date alone: the service compares it with the one the event has", () => {
    expect(
      updateEventBodySchema.safeParse({ endAt: "2026-12-12T09:00:00+05:30" })
        .success,
    ).toBe(true);
  });

  it.each([
    ["a title that is too short", { title: "ab" }, "title"],
    ["a date without an offset", { startAt: "2026-12-12T09:30:00" }, "startAt"],
    ["a venue id that is not a uuid", { venueId: "123" }, "venueId"],
    ["a capacity of 0", { capacity: 0 }, "capacity"],
    ["a fractional capacity", { capacity: 1.5 }, "capacity"],
    ["a negative price", { ticketPrice: -1 }, "ticketPrice"],
    ["a fractional price", { ticketPrice: 1.5 }, "ticketPrice"],
  ])("rejects %s", (_label, body, path) => {
    expect(paths(body)).toContain(path);
  });
});
