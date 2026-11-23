import {
  createPublishFormSchema,
  emptyPublishFormValues,
  toPublishEventRequest,
} from "../event-publish-form.schemas";
import { publishEventBodySchema } from "../events.schemas";

// "Now" is 2 Nov 2026, 15:30 in India. The event starts on 12 Dec at 09:30 in India.
const NOW = new Date("2026-11-02T10:00:00.000Z");
const EVENT_START = "2026-12-12T04:00:00.000Z";

const valid = {
  opensDate: "2026-11-03",
  opensTime: "09:00",
  closesDate: "2026-12-10",
  closesTime: "17:00",
};

const schema = createPublishFormSchema(EVENT_START);

/** The fields that have an issue, e.g. ["closesDate"], with the message of each. */
function issues(values: Partial<typeof valid>) {
  const result = schema.safeParse({ ...valid, ...values });
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((issue) => [
          issue.path.join("."),
          issue.message,
        ]),
      );
}

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

describe("createPublishFormSchema", () => {
  it("accepts a window that opens tomorrow and closes before the event starts", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("needs all four fields", () => {
    const result = schema.safeParse(emptyPublishFormValues);

    expect(result.success).toBe(false);
    expect(Object.keys(issues(emptyPublishFormValues))).toEqual(
      expect.arrayContaining([
        "opensDate",
        "opensTime",
        "closesDate",
        "closesTime",
      ]),
    );
  });

  describe("when registration opens", () => {
    it("may be today, even at a time that has passed", () => {
      expect(issues({ opensDate: "2026-11-02", opensTime: "00:30" })).toEqual(
        {},
      );
    });

    it("may not be a day before today", () => {
      expect(issues({ opensDate: "2026-11-01" })).toEqual({
        opensDate: "Registration can't start before today",
      });
    });

    it("must be before the event starts, even on the event's own day", () => {
      expect(
        issues({
          opensDate: "2026-12-12",
          opensTime: "10:00",
          closesDate: "2026-12-12",
          closesTime: "11:00",
        }),
      ).toMatchObject({
        opensDate: "Registration must start before the event starts",
      });
    });
  });

  describe("when registration closes", () => {
    it("may be on the event's day, before it starts", () => {
      expect(issues({ closesDate: "2026-12-12", closesTime: "09:00" })).toEqual(
        {},
      );
    });

    it.each([
      ["exactly when the event starts", "2026-12-12", "09:30"],
      ["after the event starts", "2026-12-12", "12:00"],
    ])("may not be %s", (_label, closesDate, closesTime) => {
      expect(issues({ closesDate, closesTime })).toEqual({
        closesDate: "Registration must end before the event starts",
      });
    });

    it("may not be a time that has passed", () => {
      expect(
        issues({
          opensDate: "2026-11-02",
          opensTime: "00:30",
          closesDate: "2026-11-02",
          closesTime: "12:00", // before 15:30, now
        }),
      ).toEqual({ closesDate: "Registration must end in the future" });
    });

    it("must be after it opens", () => {
      expect(
        issues({
          opensDate: "2026-11-05",
          closesDate: "2026-11-04",
        }),
      ).toEqual({ closesDate: "Registration must end after it starts" });
    });

    it("must be after it opens when both are on the same day", () => {
      expect(
        issues({
          opensDate: "2026-11-05",
          opensTime: "10:00",
          closesDate: "2026-11-05",
          closesTime: "10:00",
        }),
      ).toEqual({ closesDate: "Registration must end after it starts" });
    });
  });
});

describe("toPublishEventRequest", () => {
  it("sends ISO strings with India's offset", () => {
    expect(toPublishEventRequest(valid)).toEqual({
      registrationOpensAt: "2026-11-03T09:00:00+05:30",
      registrationClosesAt: "2026-12-10T17:00:00+05:30",
    });
  });

  it("builds a body the publish endpoint's own schema accepts", () => {
    expect(
      publishEventBodySchema.safeParse(toPublishEventRequest(valid)).success,
    ).toBe(true);
  });
});
