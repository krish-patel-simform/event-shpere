import { updateSessionBodySchema } from "../sessions.schemas";

const hallId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";

/** The first message for a field, or undefined when the body is fine there. */
function messageFor(input: unknown, ...path: (string | number)[]) {
  const result = updateSessionBodySchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find(
    (issue) => issue.path.join(".") === path.join("."),
  )?.message;
}

describe("updateSessionBodySchema", () => {
  it("accepts one field alone and leaves the others absent", () => {
    expect(updateSessionBodySchema.parse({ title: "  New title  " })).toEqual({
      title: "New title",
    });
  });

  it("turns times into Dates", () => {
    const body = updateSessionBodySchema.parse({
      startAt: "2026-12-12T10:00:00+05:30",
    });

    expect(body.startAt).toEqual(new Date("2026-12-12T04:30:00.000Z"));
  });

  it("rejects an empty body, and one with only unknown keys", () => {
    expect(updateSessionBodySchema.safeParse({}).success).toBe(false);
    expect(
      updateSessionBodySchema.safeParse({ status: "cancelled" }).success,
    ).toBe(false);
  });

  it("drops fields the client must not set (status, speakers, eventId)", () => {
    const body = updateSessionBodySchema.parse({
      title: "New title",
      status: "cancelled",
      eventId: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
      speakers: [],
    });

    expect(body).toEqual({ title: "New title" });
  });

  it("lets null clear the hall and the join link", () => {
    expect(
      updateSessionBodySchema.parse({ hallId: null, onlineUrl: null }),
    ).toEqual({ hallId: null, onlineUrl: null });
  });

  it("rejects bad values field by field", () => {
    expect(messageFor({ title: "ab" }, "title")).toMatch(/at least 3/);
    expect(messageFor({ type: "party" }, "type")).toBe("Choose a session type");
    expect(messageFor({ hallId: "hall-1" }, "hallId")).toBe(
      "Hall id must be a valid id",
    );
    expect(
      messageFor({ onlineUrl: "http://meet.example.com" }, "onlineUrl"),
    ).toBe("Use a link that starts with https://");
    expect(messageFor({ price: -1 }, "price")).toBe("Price cannot be negative");
    expect(messageFor({ startAt: "2026-12-12T10:00:00" }, "startAt")).toMatch(
      /time zone offset/,
    );
  });

  it("accepts a valid hall id", () => {
    expect(updateSessionBodySchema.safeParse({ hallId }).success).toBe(true);
  });
});
