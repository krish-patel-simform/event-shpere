import {
  SESSION_ABSTRACT_MAX,
  SESSION_ABSTRACT_MIN,
  SESSION_NOTES_MAX,
  SESSION_TITLE_MAX,
} from "../../constants";
import {
  sessionSubmissionSchema,
  type SessionSubmission,
} from "../session-submission.schema";

const valid: SessionSubmission = {
  title: "Offline-first Event Apps with PWAs",
  format: "talk",
  duration: "30",
  track: "mobile-web",
  level: "intermediate",
  abstract: "a".repeat(SESSION_ABSTRACT_MIN),
  takeaways: ["Choose a caching strategy", "", ""],
  coSpeakerEmail: "",
  materialUrl: "",
  availability: ["2026-12-04"],
  notes: "",
};

/** The first message for a field, or undefined when the field is fine. */
function messageFor(input: unknown, ...path: (string | number)[]) {
  const result = sessionSubmissionSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find(
    (issue) =>
      issue.path.length === path.length &&
      issue.path.every((part, index) => part === path[index]),
  )?.message;
}

describe("sessionSubmissionSchema", () => {
  it("accepts a complete submission", () => {
    expect(sessionSubmissionSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the text fields", () => {
    const result = sessionSubmissionSchema.parse({
      ...valid,
      title: "  Spaced  ",
      takeaways: ["  one  ", "", ""],
    });
    expect(result.title).toBe("Spaced");
    expect(result.takeaways[0]).toBe("one");
  });

  it("requires a title of at most 80 characters", () => {
    expect(messageFor({ ...valid, title: "   " }, "title")).toBe(
      "Enter a title",
    );
    expect(
      messageFor(
        { ...valid, title: "x".repeat(SESSION_TITLE_MAX + 1) },
        "title",
      ),
    ).toMatch(/under 80/);
    expect(
      sessionSubmissionSchema.safeParse({
        ...valid,
        title: "x".repeat(SESSION_TITLE_MAX),
      }).success,
    ).toBe(true);
  });

  it("asks for a track, a format, a duration and a level when they are missing", () => {
    expect(messageFor({ ...valid, track: "" }, "track")).toBe("Choose a track");
    expect(messageFor({ ...valid, format: "keynote" }, "format")).toBe(
      "Choose a format",
    );
    expect(messageFor({ ...valid, duration: "7" }, "duration")).toBe(
      "Choose a duration",
    );
    expect(messageFor({ ...valid, level: undefined }, "level")).toBe(
      "Choose an audience level",
    );
  });

  it("limits the abstract to 300-1200 characters and says how long it is now", () => {
    expect(
      messageFor({ ...valid, abstract: "a".repeat(236) }, "abstract"),
    ).toBe("Abstract must be at least 300 characters (currently 236).");
    expect(
      messageFor(
        { ...valid, abstract: "a".repeat(SESSION_ABSTRACT_MAX + 1) },
        "abstract",
      ),
    ).toBe("Abstract must be at most 1200 characters (currently 1201).");
    expect(
      sessionSubmissionSchema.safeParse({
        ...valid,
        abstract: "a".repeat(SESSION_ABSTRACT_MAX),
      }).success,
    ).toBe(true);
  });

  it("counts the abstract without the spaces around it", () => {
    expect(
      messageFor({ ...valid, abstract: ` ${"a".repeat(299)} ` }, "abstract"),
    ).toMatch(/currently 299/);
  });

  it("needs the first takeaway, but not the others", () => {
    expect(
      messageFor({ ...valid, takeaways: [" ", "x", "y"] }, "takeaways", 0),
    ).toBe("Add at least one takeaway");
    expect(
      sessionSubmissionSchema.safeParse({ ...valid, takeaways: ["x", "", ""] })
        .success,
    ).toBe(true);
  });

  it("limits the length of a takeaway", () => {
    expect(
      messageFor(
        { ...valid, takeaways: ["x".repeat(161), "", ""] },
        "takeaways",
        0,
      ),
    ).toMatch(/under 160/);
  });

  it("accepts an empty co-speaker email or a valid one, and refuses anything else", () => {
    expect(
      sessionSubmissionSchema.safeParse({
        ...valid,
        coSpeakerEmail: "vikram@example.com",
      }).success,
    ).toBe(true);
    expect(
      messageFor({ ...valid, coSpeakerEmail: "vikram" }, "coSpeakerEmail"),
    ).toBe("Enter a valid email address");
  });

  it("accepts an empty link or an http(s) link, and refuses other schemes", () => {
    expect(
      sessionSubmissionSchema.safeParse({
        ...valid,
        materialUrl: "https://example.com/talk",
      }).success,
    ).toBe(true);
    expect(
      messageFor(
        { ...valid, materialUrl: "javascript:alert(1)" },
        "materialUrl",
      ),
    ).toMatch(/http/);
    expect(
      messageFor({ ...valid, materialUrl: "not a link" }, "materialUrl"),
    ).toMatch(/http/);
  });

  it("needs at least one available day, as an ISO date", () => {
    expect(messageFor({ ...valid, availability: [] }, "availability")).toBe(
      "Pick at least one day you can present",
    );
    expect(
      sessionSubmissionSchema.safeParse({
        ...valid,
        availability: ["Thursday"],
      }).success,
    ).toBe(false);
  });

  it("limits the notes", () => {
    expect(
      messageFor(
        { ...valid, notes: "n".repeat(SESSION_NOTES_MAX + 1) },
        "notes",
      ),
    ).toMatch(/under 1000/);
  });

  it("keeps a lightning talk to 30 minutes", () => {
    expect(
      messageFor({ ...valid, format: "lightning", duration: "45" }, "duration"),
    ).toBe("A lightning talk is at most 30 minutes");
    expect(
      sessionSubmissionSchema.safeParse({
        ...valid,
        format: "lightning",
        duration: "15",
      }).success,
    ).toBe(true);
  });
});
