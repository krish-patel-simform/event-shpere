import {
  HALL_AVAILABILITY_MAX_DAYS,
  hallAvailabilityQuerySchema,
  hallAvailabilityResponseSchema,
} from "../hall-availability.schemas";

const valid = {
  startAt: "2026-12-12T09:00:00+05:30",
  endAt: "2026-12-12T17:00:00+05:30",
};

/** The paths of the issues a query produces, e.g. ["endAt"]. */
function issuePaths(query: unknown): string[] {
  const result = hallAvailabilityQuerySchema.safeParse(query);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."));
}

describe("hallAvailabilityQuerySchema", () => {
  it("accepts a range and turns the ISO strings into Dates", () => {
    const parsed = hallAvailabilityQuerySchema.parse(valid);

    expect(parsed.startAt).toEqual(new Date("2026-12-12T03:30:00.000Z"));
    expect(parsed.endAt).toEqual(new Date("2026-12-12T11:30:00.000Z"));
  });

  it("refuses an end that is not after the start", () => {
    expect(issuePaths({ ...valid, endAt: valid.startAt })).toContain("endAt");
    expect(
      issuePaths({ ...valid, endAt: "2026-12-12T08:00:00+05:30" }),
    ).toContain("endAt");
  });

  it("refuses a missing start or end", () => {
    expect(issuePaths({ endAt: valid.endAt })).toContain("startAt");
    expect(issuePaths({ startAt: valid.startAt })).toContain("endAt");
  });

  it("refuses a date with no time zone offset", () => {
    expect(issuePaths({ ...valid, startAt: "2026-12-12T09:00:00" })).toContain(
      "startAt",
    );
  });

  it("refuses text that is not a date", () => {
    expect(issuePaths({ ...valid, startAt: "tomorrow" })).toContain("startAt");
  });

  it("accepts a range of exactly the longest allowed length, and refuses one day more", () => {
    const start = new Date("2026-12-01T00:00:00.000Z");
    const day = 86_400_000;
    const at = (days: number) =>
      new Date(start.getTime() + days * day).toISOString();

    expect(
      issuePaths({
        startAt: at(0),
        endAt: at(HALL_AVAILABILITY_MAX_DAYS),
      }),
    ).toEqual([]);
    expect(
      issuePaths({
        startAt: at(0),
        endAt: at(HALL_AVAILABILITY_MAX_DAYS + 1),
      }),
    ).toContain("endAt");
  });
});

describe("hallAvailabilityResponseSchema", () => {
  const hall = {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    name: "Hall A",
    capacity: 300,
    busy: true,
    bookedSlots: [
      {
        startAt: "2026-12-12T04:30:00.000Z",
        endAt: "2026-12-12T06:30:00.000Z",
      },
    ],
  };

  it("accepts halls with their booked times, and an empty list", () => {
    expect(() => hallAvailabilityResponseSchema.parse([hall])).not.toThrow();
    expect(() => hallAvailabilityResponseSchema.parse([])).not.toThrow();
  });

  it("refuses a hall without its booked times", () => {
    const withoutSlots = {
      id: hall.id,
      name: hall.name,
      capacity: hall.capacity,
      busy: hall.busy,
    };

    expect(
      hallAvailabilityResponseSchema.safeParse([withoutSlots]).success,
    ).toBe(false);
  });
});
