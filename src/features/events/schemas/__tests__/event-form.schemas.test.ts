import {
  createEventFormSchema,
  emptyEventForm,
  eventFormSchema,
  eventToFormValues,
  istInstant,
  toCreateEventRequest,
  toUpdateEventRequest,
} from "../event-form.schemas";
import {
  createEventBodySchema,
  updateEventBodySchema,
} from "../events.schemas";
import { FINTECH_ID, SAMPLE_EVENTS } from "../../__fixtures__/event-manage";

/** A date (YYYY-MM-DD) a number of days from now: always in the future for the tests. */
const dayFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const valid = {
  ...emptyEventForm,
  ticketPrice: "0",
  title: "Tech Conf 2026",
  startDate: dayFromNow(30),
  endDate: dayFromNow(30),
};

/** The paths of the issues a form produces, e.g. ["endDate"]. */
function issuePaths(values: unknown): string[] {
  const result = eventFormSchema.safeParse(values);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."));
}

describe("eventFormSchema", () => {
  it("accepts a new event with just a title and dates", () => {
    expect(eventFormSchema.safeParse(valid).success).toBe(true);
  });

  it("starts empty with nine-to-five, no limit and no price typed yet", () => {
    expect(emptyEventForm).toMatchObject({
      title: "",
      startTime: "09:00",
      endTime: "17:00",
      venueId: "",
      capacity: "",
      ticketPrice: "",
    });
  });

  it("has no slug: the server makes the public link", () => {
    expect(Object.keys(emptyEventForm)).not.toContain("slug");
    expect(
      Object.keys(eventFormSchema.parse({ ...valid, slug: "mine" })),
    ).not.toContain("slug");
  });

  it("trims the title and asks for at least 3 characters", () => {
    expect(eventFormSchema.parse({ ...valid, title: "  Tech  " }).title).toBe(
      "Tech",
    );
    expect(issuePaths({ ...valid, title: "ab" })).toContain("title");
    expect(issuePaths({ ...valid, title: "a".repeat(256) })).toContain("title");
  });

  it.each([
    ["no start date", { startDate: "" }, "startDate"],
    ["no start time", { startTime: "" }, "startTime"],
    ["no end date", { endDate: "" }, "endDate"],
    ["no end time", { endTime: "" }, "endTime"],
    ["a capacity of 0", { capacity: "0" }, "capacity"],
    ["a fractional capacity", { capacity: "1.5" }, "capacity"],
    ["a capacity that is text", { capacity: "many" }, "capacity"],
    ["a negative price", { ticketPrice: "-1" }, "ticketPrice"],
    ["a price that is text", { ticketPrice: "free" }, "ticketPrice"],
    ["a price with 3 decimals", { ticketPrice: "1.234" }, "ticketPrice"],
    ["an empty price", { ticketPrice: "" }, "ticketPrice"],
  ])("rejects %s", (_label, override, path) => {
    expect(issuePaths({ ...valid, ...override })).toContain(path);
  });

  it("accepts no capacity (no limit), a venue, and a price with paise", () => {
    expect(
      eventFormSchema.safeParse({
        ...valid,
        capacity: "",
        venueId: "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d03",
        ticketPrice: "499.50",
      }).success,
    ).toBe(true);
  });

  it("rejects a start in the past", () => {
    expect(
      issuePaths({ ...valid, startDate: "2020-01-01", endDate: "2020-01-01" }),
    ).toContain("startDate");
  });

  it("rejects an end that is not after the start", () => {
    expect(
      issuePaths({ ...valid, endDate: valid.startDate, endTime: "08:00" }),
    ).toContain("endDate");
    expect(
      issuePaths({ ...valid, endDate: valid.startDate, endTime: "09:00" }),
    ).toContain("endDate");
  });

  it("accepts an event that ends the next day", () => {
    expect(
      eventFormSchema.safeParse({
        ...valid,
        endDate: dayFromNow(31),
        endTime: "08:00",
      }).success,
    ).toBe(true);
  });
});

describe("istInstant", () => {
  it("reads a date and time as India Standard Time", () => {
    expect(istInstant("2026-12-12", "09:30")?.toISOString()).toBe(
      "2026-12-12T04:00:00.000Z",
    );
  });

  it("is null for an empty or malformed date or time", () => {
    expect(istInstant("", "09:30")).toBeNull();
    expect(istInstant("2026-12-12", "")).toBeNull();
    expect(istInstant("12/12/2026", "09:30")).toBeNull();
    expect(istInstant("2026-13-45", "09:30")).toBeNull();
  });
});

describe("eventToFormValues", () => {
  it("turns an event into the form's text inputs, in the event's zone", () => {
    const event = SAMPLE_EVENTS.find((item) => item.id === FINTECH_ID);
    if (!event) throw new Error("no sample event");

    expect(eventToFormValues(event)).toEqual({
      title: "Fintech Product Forum",
      startDate: "2026-12-12",
      startTime: "09:30",
      endDate: "2026-12-12",
      endTime: "17:30",
      venueId: "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d03",
      capacity: "250",
      ticketPrice: "0",
    });
  });

  it("shows no limit as an empty capacity and the price in rupees", () => {
    const event = SAMPLE_EVENTS[1];

    expect(
      eventToFormValues({ ...event, capacity: null, venue: null }),
    ).toMatchObject({ capacity: "", venueId: "", ticketPrice: "499" });
  });
});

describe("createEventFormSchema: editing a running event", () => {
  // It started long ago: its start is in the past but is not a mistake.
  const running = {
    ...valid,
    startDate: "2020-01-01",
    startTime: "09:00",
    endDate: "2099-01-01",
  };

  it("refuses a past start for a new event", () => {
    expect(createEventFormSchema().safeParse(running).success).toBe(false);
  });

  it("accepts the start the event already has, even in the past", () => {
    const schema = createEventFormSchema({
      startDate: "2020-01-01",
      startTime: "09:00",
    });

    expect(schema.safeParse(running).success).toBe(true);
  });

  it("still refuses a start that was typed in and is in the past", () => {
    const schema = createEventFormSchema({
      startDate: "2020-01-01",
      startTime: "09:00",
    });

    expect(
      schema.safeParse({ ...running, startDate: "2020-02-02" }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...running, startTime: "10:00" }).success).toBe(
      false,
    );
  });

  it("still needs the end to be after the start", () => {
    const schema = createEventFormSchema({
      startDate: "2020-01-01",
      startTime: "09:00",
    });

    expect(
      schema.safeParse({ ...running, endDate: "2019-12-31" }).success,
    ).toBe(false);
  });
});

describe("toCreateEventRequest", () => {
  const form = {
    ...emptyEventForm,
    title: "Tech Conf",
    startDate: "2026-12-12",
    endDate: "2026-12-12",
  };

  it("makes ISO dates with India's offset, and leaves an empty venue and limit out", () => {
    expect(toCreateEventRequest(form)).toEqual({
      title: "Tech Conf",
      startAt: "2026-12-12T09:00:00+05:30",
      endAt: "2026-12-12T17:00:00+05:30",
      timezone: "Asia/Kolkata",
      ticketPrice: 0,
    });
  });

  it("sends the venue and the capacity when there are some", () => {
    const venueId = "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d03";

    expect(
      toCreateEventRequest({ ...form, venueId, capacity: "250" }),
    ).toMatchObject({ venueId, capacity: 250 });
  });

  it("turns rupees into paise without floating point noise", () => {
    expect(
      toCreateEventRequest({ ...form, ticketPrice: "499.50" }).ticketPrice,
    ).toBe(49950);
    expect(
      toCreateEventRequest({ ...form, ticketPrice: "0.07" }).ticketPrice,
    ).toBe(7);
    expect(
      toCreateEventRequest({ ...form, ticketPrice: "1500" }).ticketPrice,
    ).toBe(150000);
  });

  it("sends a body the API's own schema accepts", () => {
    const body = toCreateEventRequest({
      ...form,
      startDate: dayFromNow(30),
      endDate: dayFromNow(30),
      capacity: "100",
    });

    expect(createEventBodySchema.safeParse(body).success).toBe(true);
  });
});

describe("toUpdateEventRequest", () => {
  const form = {
    ...emptyEventForm,
    title: "Tech Conf",
    startDate: "2026-12-12",
    endDate: "2026-12-13",
    startTime: "09:30",
    endTime: "17:30",
  };

  it("sends every field the form edits", () => {
    const venueId = "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d03";

    expect(
      toUpdateEventRequest({
        ...form,
        venueId,
        capacity: "250",
        ticketPrice: "10",
      }),
    ).toEqual({
      title: "Tech Conf",
      startAt: "2026-12-12T09:30:00+05:30",
      endAt: "2026-12-13T17:30:00+05:30",
      venueId,
      capacity: 250,
      ticketPrice: 1000,
    });
  });

  it("sends null, not nothing, to clear the venue and the limit", () => {
    expect(toUpdateEventRequest(form)).toMatchObject({
      venueId: null,
      capacity: null,
    });
  });

  it("sends a body the API's own schema accepts", () => {
    const body = toUpdateEventRequest({ ...form, capacity: "100" });

    expect(updateEventBodySchema.safeParse(body).success).toBe(true);
  });
});
