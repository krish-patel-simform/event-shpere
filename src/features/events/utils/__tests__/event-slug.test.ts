import { slugify } from "../event-slug";

describe("slugify", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugify("Tech Conf 2026")).toBe("tech-conf-2026");
  });

  it("drops symbols and collapses repeated separators", () => {
    expect(slugify("AI & ML:  The   Future!!")).toBe("ai-ml-the-future");
  });

  it("removes accents", () => {
    expect(slugify("Café Münch Événement")).toBe("cafe-munch-evenement");
  });

  it("trims dashes from both ends", () => {
    expect(slugify("  --Hello--  ")).toBe("hello");
  });

  it("falls back to 'event' when nothing usable is left", () => {
    expect(slugify("!!!")).toBe("event");
    expect(slugify("मराठी संमेलन")).toBe("event");
  });

  it("cuts long titles to 80 characters without a trailing dash", () => {
    const slug = slugify(`${"a".repeat(79)} bbbb`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("long runs of dashes and symbols on both ends and in the middle become single dashes", () => {
    const dashes = "-".repeat(100);
    expect(slugify(`${dashes}Hello${dashes}World${dashes}`)).toBe(
      "hello-world",
    );
    expect(slugify(` -_-_- Hello !?!?-- World -_-_- `)).toBe("hello-world");
  });

  it("a title of only dashes falls back to 'event'", () => {
    expect(slugify("-".repeat(255))).toBe("event");
  });

  it("a cut that lands right after a word's dash drops that one dash", () => {
    // 79 letters, a space, more letters: the 80th character of the slug is the dash.
    expect(slugify(`${"a".repeat(79)} bbbb`)).toBe("a".repeat(79));
  });

  it("never leaves two dashes in a row", () => {
    expect(slugify("A -- B ... C ___ D")).toBe("a-b-c-d");
  });
});
