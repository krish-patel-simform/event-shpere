import {
  SESSION_CONTENT_LIMITS,
  updateSessionContentBodySchema,
} from "../session-content.schemas";

/** The first message for a field, or undefined when the body is fine there. */
function messageFor(input: unknown, ...path: (string | number)[]) {
  const result = updateSessionContentBodySchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find(
    (issue) => issue.path.join(".") === path.join("."),
  )?.message;
}

describe("updateSessionContentBodySchema", () => {
  it("accepts one field alone and keeps the others absent", () => {
    const body = updateSessionContentBodySchema.parse({
      prerequisites: " Know some JS ",
    });

    expect(body).toEqual({ prerequisites: "Know some JS" });
  });

  it("rejects an empty body, and one with only unknown keys", () => {
    expect(updateSessionContentBodySchema.safeParse({}).success).toBe(false);
    expect(
      updateSessionContentBodySchema.safeParse({ status: "published" }).success,
    ).toBe(false);
  });

  it("lets null clear the description and the prerequisites", () => {
    const body = updateSessionContentBodySchema.parse({
      description: null,
      prerequisites: null,
    });

    expect(body).toEqual({ description: null, prerequisites: null });
  });

  it("rejects texts over their limits", () => {
    expect(
      messageFor(
        { description: "a".repeat(SESSION_CONTENT_LIMITS.description + 1) },
        "description",
      ),
    ).toBeDefined();
    expect(
      messageFor(
        { prerequisites: "a".repeat(SESSION_CONTENT_LIMITS.prerequisites + 1) },
        "prerequisites",
      ),
    ).toBeDefined();
  });

  describe("resources", () => {
    const resource = { label: "Slides", url: "https://example.com/slides" };

    it("accepts a list of labelled https links", () => {
      expect(
        updateSessionContentBodySchema.safeParse({ resources: [resource] })
          .success,
      ).toBe(true);
    });

    it("accepts an empty list (it clears them all)", () => {
      expect(updateSessionContentBodySchema.parse({ resources: [] })).toEqual({
        resources: [],
      });
    });

    it("rejects a link that is not https", () => {
      expect(
        messageFor(
          { resources: [{ ...resource, url: "http://example.com" }] },
          "resources",
          0,
          "url",
        ),
      ).toBe("Use a link that starts with https://");
      expect(
        messageFor(
          { resources: [{ ...resource, url: "javascript:alert(1)" }] },
          "resources",
          0,
          "url",
        ),
      ).toBeDefined();
    });

    it("rejects a blank label", () => {
      expect(
        messageFor(
          { resources: [{ ...resource, label: "  " }] },
          "resources",
          0,
          "label",
        ),
      ).toBe("Label is required");
    });

    it("rejects more than the allowed number of resources", () => {
      const tooMany = Array.from(
        { length: SESSION_CONTENT_LIMITS.resources + 1 },
        () => resource,
      );

      expect(messageFor({ resources: tooMany }, "resources")).toBeDefined();
    });
  });
});
