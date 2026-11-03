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
});
