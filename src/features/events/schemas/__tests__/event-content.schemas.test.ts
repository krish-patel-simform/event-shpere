import {
  eventIdParam,
  galleryImageParam,
  updateEventContentBodySchema,
} from "../event-content.schemas";

const parse = (body: unknown) => updateEventContentBodySchema.safeParse(body);

/** The paths of the issues a body produces, e.g. ["faqs.0.answer"]. */
function issuePaths(body: unknown): string[] {
  const result = parse(body);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."));
}

describe("updateEventContentBodySchema", () => {
  it("accepts a body with just one field", () => {
    expect(parse({ tagline: "Learn it all" }).success).toBe(true);
  });

  it("rejects an empty body, and a body of only unknown fields", () => {
    expect(parse({}).success).toBe(false);
    // Unknown keys are dropped, so nothing is left to change.
    expect(parse({ coverImage: 5, status: "published" }).success).toBe(false);
  });

  it("trims texts and keeps null as a way to clear a field", () => {
    const result = updateEventContentBodySchema.parse({
      tagline: "  Hello  ",
      about: null,
      seo: null,
    });

    expect(result).toEqual({ tagline: "Hello", about: null, seo: null });
  });

  it("does not let the body carry the images", () => {
    const result = updateEventContentBodySchema.parse({
      tagline: "x",
      coverImage: 5,
      gallery: [1, 2],
    });

    expect(Object.keys(result)).toEqual(["tagline"]);
  });

  it("fills an omitted highlight description with an empty text", () => {
    const result = updateEventContentBodySchema.parse({
      highlights: [{ title: "Keynote" }],
    });

    expect(result.highlights).toEqual([{ title: "Keynote", description: "" }]);
  });

  it.each([
    ["a tagline over 160 characters", { tagline: "a".repeat(161) }, "tagline"],
    ["an about over 10000 characters", { about: "a".repeat(10_001) }, "about"],
    [
      "a venue guide over 5000 characters",
      { venueGuide: "a".repeat(5_001) },
      "venueGuide",
    ],
    [
      "a highlight with no title",
      { highlights: [{ title: "  " }] },
      "highlights.0.title",
    ],
    [
      "more than 8 highlights",
      { highlights: Array.from({ length: 9 }, () => ({ title: "x" })) },
      "highlights",
    ],
    [
      "a FAQ with no answer",
      { faqs: [{ question: "Parking?", answer: " " }] },
      "faqs.0.answer",
    ],
    [
      "more than 20 FAQs",
      {
        faqs: Array.from({ length: 21 }, () => ({
          question: "q",
          answer: "a",
        })),
      },
      "faqs",
    ],
    [
      "a meta title over 70 characters",
      { seo: { metaTitle: "a".repeat(71) } },
      "seo.metaTitle",
    ],
    [
      "a meta description over 160 characters",
      { seo: { metaDescription: "a".repeat(161) } },
      "seo.metaDescription",
    ],
  ])("rejects %s", (_label, body, path) => {
    expect(issuePaths(body)).toContain(path);
  });
});

describe("path params", () => {
  const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";

  it("needs the event id to be a uuid", () => {
    expect(eventIdParam.safeParse({ eventId }).success).toBe(true);
    expect(eventIdParam.safeParse({ eventId: "123" }).success).toBe(false);
  });

  it("reads the gallery file id from the URL as a positive whole number", () => {
    expect(galleryImageParam.parse({ eventId, fileId: "31" }).fileId).toBe(31);
    for (const fileId of ["0", "-1", "1.5", "abc", ""]) {
      expect(galleryImageParam.safeParse({ eventId, fileId }).success).toBe(
        false,
      );
    }
  });
});
