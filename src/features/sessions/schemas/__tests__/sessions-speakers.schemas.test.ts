import { replaceSessionSpeakersBodySchema } from "../sessions.schemas";

const speakerId = "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d";
const otherSpeakerId = "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e";

/** The first message for a field, or undefined when the body is fine there. */
function messageFor(input: unknown, ...path: (string | number)[]) {
  const result = replaceSessionSpeakersBodySchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find(
    (issue) => issue.path.join(".") === path.join("."),
  )?.message;
}

describe("replaceSessionSpeakersBodySchema", () => {
  it("accepts a list and defaults the role to speaker", () => {
    expect(
      replaceSessionSpeakersBodySchema.parse({ speakers: [{ speakerId }] }),
    ).toEqual({ speakers: [{ speakerId, role: "speaker" }] });
  });

  it("keeps the order and the roles", () => {
    const body = replaceSessionSpeakersBodySchema.parse({
      speakers: [
        { speakerId: otherSpeakerId, role: "moderator" },
        { speakerId, role: "speaker" },
      ],
    });

    expect(body.speakers.map((speaker) => speaker.speakerId)).toEqual([
      otherSpeakerId,
      speakerId,
    ]);
    expect(body.speakers.map((speaker) => speaker.role)).toEqual([
      "moderator",
      "speaker",
    ]);
  });

  it("needs at least one speaker", () => {
    expect(messageFor({ speakers: [] }, "speakers")).toBe(
      "Add at least one speaker",
    );
  });

  it("needs the speakers field", () => {
    expect(replaceSessionSpeakersBodySchema.safeParse({}).success).toBe(false);
  });

  it("rejects an id that is not a uuid", () => {
    expect(
      messageFor(
        { speakers: [{ speakerId: "abc" }] },
        "speakers",
        0,
        "speakerId",
      ),
    ).toBe("Speaker id must be a valid id");
  });

  it("rejects the same speaker twice, pointing at the repeat", () => {
    expect(
      messageFor(
        { speakers: [{ speakerId }, { speakerId, role: "moderator" }] },
        "speakers",
        1,
        "speakerId",
      ),
    ).toBe("This speaker is added twice");
  });

  it("rejects a list with only moderators", () => {
    expect(
      messageFor({ speakers: [{ speakerId, role: "moderator" }] }, "speakers"),
    ).toMatch(/at least one speaker/);
  });

  it("rejects an unknown role", () => {
    expect(
      replaceSessionSpeakersBodySchema.safeParse({
        speakers: [{ speakerId, role: "dj" }],
      }).success,
    ).toBe(false);
  });
});
