import { createSpeakerSlug } from "../speaker-slug";

describe("createSpeakerSlug", () => {
  it("joins the name in lowercase with the suffix", () => {
    expect(createSpeakerSlug("Ankit", "Sharma", "3f9a1c")).toBe(
      "ankit-sharma-3f9a1c",
    );
  });

  it("drops accents and anything that is not a letter or digit", () => {
    expect(createSpeakerSlug("José", "O'Brien-Smith!", "abc123")).toBe(
      "jose-o-brien-smith-abc123",
    );
  });

  it("falls back to 'speaker' for a name with no latin letters", () => {
    expect(createSpeakerSlug("李", "雷", "abc123")).toBe("speaker-abc123");
  });

  it("caps the name part at 60 characters", () => {
    const slug = createSpeakerSlug("a".repeat(100), "b", "abc123");

    expect(slug).toBe(`${"a".repeat(60)}-abc123`);
  });

  it("adds a random 6-character suffix by default", () => {
    expect(createSpeakerSlug("Ankit", "Sharma")).toMatch(
      /^ankit-sharma-[0-9a-f]{6}$/,
    );
  });
});
