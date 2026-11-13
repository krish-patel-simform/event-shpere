import {
  createSessionBodySchema,
  type CreateSessionRequest,
} from "../sessions.schemas";

const hallId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const speakerId = "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d";
const otherSpeakerId = "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e";

const valid: CreateSessionRequest = {
  title: "Offline-first Event Apps",
  type: "talk",
  mode: "in_person",
  hallId,
  startAt: "2026-12-12T10:00:00+05:30",
  endAt: "2026-12-12T11:00:00+05:30",
  speakers: [{ speakerId }],
};

/** The first message for a field, or undefined when the body is fine there. */
function messageFor(input: unknown, ...path: (string | number)[]) {
  const result = createSessionBodySchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find(
    (issue) => issue.path.join(".") === path.join("."),
  )?.message;
}

describe("createSessionBodySchema", () => {
  it("accepts an in-person session and turns the times into Dates", () => {
    const body = createSessionBodySchema.parse(valid);

    expect(body.startAt).toEqual(new Date("2026-12-12T04:30:00.000Z"));
    expect(body.endAt).toEqual(new Date("2026-12-12T05:30:00.000Z"));
  });

  it("applies the defaults: no seat booking, included in the ticket, role speaker", () => {
    const body = createSessionBodySchema.parse(valid);

    expect(body.requiresRegistration).toBe(false);
    expect(body.price).toBe(0);
    expect(body.speakers).toEqual([{ speakerId, role: "speaker" }]);
  });

  it("drops fields the client must not set (status, eventId, cmsSessionId)", () => {
    const body = createSessionBodySchema.parse({
      ...valid,
      status: "cancelled",
      eventId: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
      cmsSessionId: "x",
    });

    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("eventId");
    expect(body).not.toHaveProperty("cmsSessionId");
  });

  describe("title, type and times", () => {
    it("rejects a title under 3 characters", () => {
      expect(messageFor({ ...valid, title: " ab " }, "title")).toMatch(
        /at least 3/,
      );
    });

    it("rejects an unknown type", () => {
      expect(messageFor({ ...valid, type: "party" }, "type")).toBe(
        "Choose a session type",
      );
    });

    it("rejects an end that is not after the start (equal and earlier)", () => {
      expect(messageFor({ ...valid, endAt: valid.startAt }, "endAt")).toBe(
        "End must be after the start",
      );
      expect(
        messageFor({ ...valid, endAt: "2026-12-12T09:00:00+05:30" }, "endAt"),
      ).toBe("End must be after the start");
    });

    it("rejects a time without a zone offset", () => {
      expect(
        messageFor({ ...valid, startAt: "2026-12-12T10:00:00" }, "startAt"),
      ).toMatch(/time zone offset/);
    });

    it("rejects a negative or fractional price", () => {
      expect(messageFor({ ...valid, price: -1 }, "price")).toBe(
        "Price cannot be negative",
      );
      expect(messageFor({ ...valid, price: 10.5 }, "price")).toBeDefined();
    });
  });

  describe("hall and join link by mode", () => {
    const online = {
      ...valid,
      mode: "online",
      hallId: undefined,
      onlineUrl: "https://meet.example.com/abc",
    };

    it("needs a hall for an in-person session", () => {
      expect(messageFor({ ...valid, hallId: undefined }, "hallId")).toBe(
        "Choose a hall",
      );
    });

    it("refuses a join link on an in-person session", () => {
      expect(
        messageFor(
          { ...valid, onlineUrl: "https://meet.example.com/abc" },
          "onlineUrl",
        ),
      ).toBe("An in-person session has no join link");
    });

    it("accepts an online session with a link and no hall", () => {
      expect(createSessionBodySchema.safeParse(online).success).toBe(true);
    });

    it("needs a link for an online session", () => {
      expect(messageFor({ ...online, onlineUrl: undefined }, "onlineUrl")).toBe(
        "Add the join link",
      );
    });

    it("refuses a hall on an online session", () => {
      expect(messageFor({ ...online, hallId }, "hallId")).toBe(
        "An online session has no hall",
      );
    });

    it("needs both a hall and a link for a hybrid session", () => {
      const hybrid = { ...valid, mode: "hybrid", onlineUrl: online.onlineUrl };

      expect(createSessionBodySchema.safeParse(hybrid).success).toBe(true);
      expect(messageFor({ ...hybrid, hallId: undefined }, "hallId")).toBe(
        "Choose a hall",
      );
      expect(messageFor({ ...hybrid, onlineUrl: undefined }, "onlineUrl")).toBe(
        "Add the join link",
      );
    });

    it("rejects a link that is not https", () => {
      expect(
        messageFor(
          { ...online, onlineUrl: "http://meet.example.com/abc" },
          "onlineUrl",
        ),
      ).toBe("Use a link that starts with https://");
    });

    it("rejects a hall id that is not a uuid", () => {
      expect(messageFor({ ...valid, hallId: "hall-1" }, "hallId")).toBe(
        "Hall id must be a valid id",
      );
    });
  });

  describe("speakers", () => {
    it("needs at least one speaker", () => {
      expect(messageFor({ ...valid, speakers: [] }, "speakers")).toBe(
        "Add at least one speaker",
      );
    });

    it("rejects a speaker id that is not a uuid", () => {
      expect(
        messageFor(
          { ...valid, speakers: [{ speakerId: "abc" }] },
          "speakers",
          0,
          "speakerId",
        ),
      ).toBe("Speaker id must be a valid id");
    });

    it("rejects the same speaker twice", () => {
      expect(
        messageFor(
          {
            ...valid,
            speakers: [{ speakerId }, { speakerId, role: "moderator" }],
          },
          "speakers",
          1,
          "speakerId",
        ),
      ).toBe("This speaker is added twice");
    });

    it("rejects a session with only moderators", () => {
      expect(
        messageFor(
          { ...valid, speakers: [{ speakerId, role: "moderator" }] },
          "speakers",
        ),
      ).toMatch(/at least one speaker/);
    });

    it("accepts a moderator next to a speaker and keeps the order", () => {
      const body = createSessionBodySchema.parse({
        ...valid,
        speakers: [
          { speakerId: otherSpeakerId, role: "moderator" },
          { speakerId, role: "speaker" },
        ],
      });

      expect(body.speakers.map((speaker) => speaker.role)).toEqual([
        "moderator",
        "speaker",
      ]);
    });
  });
});
