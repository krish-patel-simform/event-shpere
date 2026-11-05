import {
  createSessionFormSchema,
  emptySessionForm,
  sessionFormSchema,
  sessionToFormValues,
  toCreateSessionRequest,
  toUpdateSessionRequest,
  type SessionFormValues,
} from "../session-form.schemas";

// The events feature's barrel pulls in components: only its pure time and price helpers are needed.
jest.mock("../../../events", () => ({
  ...jest.requireActual("../../../events/schemas/event-form.schemas"),
  ...jest.requireActual("../../../events/utils/event-display"),
}));

const hallId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const speakerId = "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d";

const valid: SessionFormValues = {
  ...emptySessionForm,
  title: "Offline-first Event Apps",
  type: "talk",
  hallId,
  date: "2026-12-12",
  startTime: "10:00",
  endTime: "11:00",
  price: "0",
};

/** The first message for a field, or undefined when the values are fine there. */
function messageFor(input: unknown, field: string, schema = sessionFormSchema) {
  const result = schema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join(".") === field)
    ?.message;
}

describe("sessionFormSchema", () => {
  it("accepts an in-person session with a hall", () => {
    expect(sessionFormSchema.safeParse(valid).success).toBe(true);
  });

  it("starts empty with nothing chosen, so a new form shows its messages on submit", () => {
    expect(messageFor(emptySessionForm, "title")).toMatch(/at least 3/);
    expect(messageFor(emptySessionForm, "type")).toBe("Choose a session type");
    expect(messageFor(emptySessionForm, "date")).toBe("Date is required");
  });

  describe("title, price and times", () => {
    it("trims the title and keeps its limits", () => {
      expect(messageFor({ ...valid, title: "  ab " }, "title")).toMatch(
        /at least 3/,
      );
      expect(messageFor({ ...valid, title: "a".repeat(256) }, "title")).toMatch(
        /255/,
      );
    });

    it("rejects a price that is not an amount, and accepts paise", () => {
      expect(messageFor({ ...valid, price: "" }, "price")).toBe(
        "Enter an amount like 0 or 499.50",
      );
      expect(messageFor({ ...valid, price: "-5" }, "price")).toBeDefined();
      expect(messageFor({ ...valid, price: "1.234" }, "price")).toBeDefined();
      expect(
        sessionFormSchema.safeParse({ ...valid, price: "499.50" }).success,
      ).toBe(true);
    });

    it("wants the end after the start (equal is not enough), on the end time field", () => {
      expect(messageFor({ ...valid, endTime: "10:00" }, "endTime")).toBe(
        "End must be after the start",
      );
      expect(messageFor({ ...valid, endTime: "09:30" }, "endTime")).toBe(
        "End must be after the start",
      );
    });

    it("reports a missing time once, not twice", () => {
      const result = sessionFormSchema.safeParse({ ...valid, startTime: "" });

      expect(result.success).toBe(false);
      const startIssues = result.success
        ? []
        : result.error.issues.filter(
            (issue) => issue.path.join(".") === "startTime",
          );
      expect(startIssues).toHaveLength(1);
      expect(startIssues[0]?.message).toBe("Start time is required");
    });
  });

  describe("hall and link by mode", () => {
    const online: SessionFormValues = {
      ...valid,
      mode: "online",
      hallId: "",
      onlineUrl: "https://meet.example.com/abc",
    };

    it("needs a hall for an in-person session", () => {
      expect(messageFor({ ...valid, hallId: "" }, "hallId")).toBe(
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
      expect(sessionFormSchema.safeParse(online).success).toBe(true);
    });

    it("needs a link for an online session, and refuses a hall", () => {
      expect(messageFor({ ...online, onlineUrl: "" }, "onlineUrl")).toBe(
        "Add the join link",
      );
      expect(messageFor({ ...online, hallId }, "hallId")).toBe(
        "An online session has no hall",
      );
    });

    it("needs both for a hybrid session", () => {
      const hybrid = { ...online, mode: "hybrid", hallId };

      expect(sessionFormSchema.safeParse(hybrid).success).toBe(true);
      expect(messageFor({ ...hybrid, hallId: "" }, "hallId")).toBe(
        "Choose a hall",
      );
      expect(messageFor({ ...hybrid, onlineUrl: "" }, "onlineUrl")).toBe(
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
  });
});

describe("createSessionFormSchema", () => {
  const created = { ...valid, speakers: [{ speakerId, role: "speaker" }] };

  it("accepts the details with at least one speaker", () => {
    expect(createSessionFormSchema.safeParse(created).success).toBe(true);
  });

  it("needs a speaker, no repeats, and not only moderators", () => {
    expect(
      messageFor(
        { ...created, speakers: [] },
        "speakers",
        createSessionFormSchema,
      ),
    ).toBe("Add at least one speaker");
    expect(
      messageFor(
        { ...created, speakers: [{ speakerId }, { speakerId }] },
        "speakers.1.speakerId",
        createSessionFormSchema,
      ),
    ).toBe("This speaker is added twice");
    expect(
      messageFor(
        { ...created, speakers: [{ speakerId, role: "moderator" }] },
        "speakers",
        createSessionFormSchema,
      ),
    ).toMatch(/at least one speaker/);
  });

  it("still applies the mode rules to the details", () => {
    expect(
      messageFor({ ...created, hallId: "" }, "hallId", createSessionFormSchema),
    ).toBe("Choose a hall");
  });
});

describe("toCreateSessionRequest", () => {
  it("builds the body: times with the event's offset, price in paise, hall and no link", () => {
    expect(
      toCreateSessionRequest({ ...valid, price: "499.50" }, [
        { speakerId, role: "speaker" },
      ]),
    ).toEqual({
      title: "Offline-first Event Apps",
      type: "talk",
      mode: "in_person",
      hallId,
      startAt: "2026-12-12T10:00:00+05:30",
      endAt: "2026-12-12T11:00:00+05:30",
      requiresRegistration: false,
      price: 49950,
      speakers: [{ speakerId, role: "speaker" }],
    });
  });

  it("leaves an empty hall or link out instead of sending an empty text", () => {
    const body = toCreateSessionRequest(
      {
        ...valid,
        mode: "online",
        hallId: "",
        onlineUrl: "https://meet.example.com/abc",
      },
      [{ speakerId }],
    );

    expect(body).not.toHaveProperty("hallId");
    expect(body.onlineUrl).toBe("https://meet.example.com/abc");
  });

  it("rounds the price, because 0.07 * 100 is 7.000000000000001", () => {
    expect(
      toCreateSessionRequest({ ...valid, price: "0.07" }, [{ speakerId }])
        .price,
    ).toBe(7);
  });

  it("refuses a type the form never validated", () => {
    expect(() =>
      toCreateSessionRequest({ ...valid, type: "" }, [{ speakerId }]),
    ).toThrow(/session type/);
  });
});

describe("toUpdateSessionRequest", () => {
  it("sends every field the form edits", () => {
    expect(toUpdateSessionRequest(valid)).toEqual({
      title: "Offline-first Event Apps",
      type: "talk",
      mode: "in_person",
      hallId,
      onlineUrl: null,
      startAt: "2026-12-12T10:00:00+05:30",
      endAt: "2026-12-12T11:00:00+05:30",
      requiresRegistration: false,
      price: 0,
    });
  });

  it("sends null for an empty hall or link, so the old one is cleared (switching to online)", () => {
    const body = toUpdateSessionRequest({
      ...valid,
      mode: "online",
      hallId: "",
      onlineUrl: "https://meet.example.com/abc",
    });

    expect(body.hallId).toBeNull();
    expect(body.onlineUrl).toBe("https://meet.example.com/abc");
  });
});

describe("sessionToFormValues", () => {
  const saved = {
    title: "Offline-first Event Apps",
    type: "talk" as const,
    mode: "hybrid" as const,
    hallId,
    onlineUrl: "https://meet.example.com/abc",
    startAt: "2026-12-12T04:30:00.000Z",
    endAt: "2026-12-12T05:30:00.000Z",
    requiresRegistration: true,
    price: 49950,
  };

  it("shows the saved date and times in the event's own zone", () => {
    const values = sessionToFormValues(saved, "Asia/Kolkata");

    expect(values.date).toBe("2026-12-12");
    expect(values.startTime).toBe("10:00");
    expect(values.endTime).toBe("11:00");
  });

  it("turns paise back into rupees and keeps the other fields", () => {
    expect(sessionToFormValues(saved, "Asia/Kolkata")).toMatchObject({
      title: "Offline-first Event Apps",
      type: "talk",
      mode: "hybrid",
      hallId,
      onlineUrl: "https://meet.example.com/abc",
      requiresRegistration: true,
      price: "499.5",
    });
  });

  it("shows an empty hall and link as empty inputs, never null", () => {
    const values = sessionToFormValues(
      { ...saved, mode: "online", hallId: null, onlineUrl: null },
      "Asia/Kolkata",
    );

    expect(values.hallId).toBe("");
    expect(values.onlineUrl).toBe("");
  });

  it("round-trips: what the form loads is what an unchanged save sends", () => {
    const values = sessionToFormValues(saved, "Asia/Kolkata");

    expect(toUpdateSessionRequest(values)).toMatchObject({
      startAt: "2026-12-12T10:00:00+05:30",
      endAt: "2026-12-12T11:00:00+05:30",
      hallId,
      price: 49950,
    });
  });
});
