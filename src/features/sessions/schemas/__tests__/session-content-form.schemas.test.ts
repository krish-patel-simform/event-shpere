import { SESSION_CONTENT_LIMITS } from "../session-content.schemas";
import {
  contentToFormValues,
  sessionContentFormSchema,
  toUpdateContentRequest,
} from "../session-content-form.schemas";

const valid = {
  description: "A talk about offline apps.",
  prerequisites: "",
  resources: [{ label: "Slides", url: "https://example.com/slides" }],
};

describe("sessionContentFormSchema", () => {
  it("accepts a written description with a link", () => {
    expect(sessionContentFormSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts nothing written at all: the content is optional", () => {
    expect(
      sessionContentFormSchema.safeParse({
        description: "",
        prerequisites: "",
        resources: [],
      }).success,
    ).toBe(true);
  });

  it("trims the texts", () => {
    const result = sessionContentFormSchema.parse({
      ...valid,
      description: "  Hello  ",
    });

    expect(result.description).toBe("Hello");
  });

  it("refuses a description that is too long, with the limit in the message", () => {
    const result = sessionContentFormSchema.safeParse({
      ...valid,
      description: "a".repeat(SESSION_CONTENT_LIMITS.description + 1),
    });

    expect(result.error?.issues[0].message).toBe(
      "Description must be 10,000 characters or fewer",
    );
  });

  it("refuses a link without a label", () => {
    const result = sessionContentFormSchema.safeParse({
      ...valid,
      resources: [{ label: "  ", url: "https://example.com" }],
    });

    expect(result.error?.issues[0]).toMatchObject({
      path: ["resources", 0, "label"],
      message: "Give the link a label",
    });
  });

  it.each(["", "example.com", "http://example.com", "javascript:alert(1)"])(
    "refuses %j as a link: only https:// is allowed",
    (url) => {
      const result = sessionContentFormSchema.safeParse({
        ...valid,
        resources: [{ label: "Slides", url }],
      });

      expect(result.error?.issues[0]).toMatchObject({
        path: ["resources", 0, "url"],
        message: "Use a link that starts with https://",
      });
    },
  );

  it("refuses more links than the server takes", () => {
    const result = sessionContentFormSchema.safeParse({
      ...valid,
      resources: Array.from(
        { length: SESSION_CONTENT_LIMITS.resources + 1 },
        (_, index) => ({
          label: `Link ${index}`,
          url: "https://example.com",
        }),
      ),
    });

    expect(result.error?.issues[0].message).toBe("Add at most 10 links");
  });
});

describe("contentToFormValues and toUpdateContentRequest", () => {
  it("shows a text that was never written as empty, not null", () => {
    expect(
      contentToFormValues({
        description: "",
        prerequisites: null,
        resources: [],
        coverImage: null,
      }),
    ).toEqual({ description: "", prerequisites: "", resources: [] });
  });

  it("sends every field, so an empty text clears the saved one", () => {
    expect(
      toUpdateContentRequest({
        description: "",
        prerequisites: "",
        resources: [],
      }),
    ).toEqual({ description: "", prerequisites: "", resources: [] });
  });

  it("never sends the cover: it has its own endpoint", () => {
    const body = toUpdateContentRequest(
      contentToFormValues({
        description: "Hi",
        prerequisites: null,
        resources: [],
        coverImage: {
          id: 1,
          url: "https://cms.example.com/c.jpg",
          alt: null,
          width: null,
          height: null,
        },
      }),
    );

    expect(body).not.toHaveProperty("coverImage");
  });
});
