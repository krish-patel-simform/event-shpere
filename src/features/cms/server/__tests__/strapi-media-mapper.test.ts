import { createCmsMediaMapper } from "../strapi-media-mapper";

const { absoluteUrl, toCmsMedia } = createCmsMediaMapper("http://cms.test");

describe("absoluteUrl", () => {
  it("prefixes a local upload with the Strapi address", () => {
    expect(absoluteUrl("/uploads/x.jpg")).toBe("http://cms.test/uploads/x.jpg");
  });

  it("adds the missing slash", () => {
    expect(absoluteUrl("uploads/x.jpg")).toBe("http://cms.test/uploads/x.jpg");
  });

  it("leaves a cloud provider's absolute URL alone", () => {
    expect(absoluteUrl("https://cdn.example.com/x.jpg")).toBe(
      "https://cdn.example.com/x.jpg",
    );
    expect(absoluteUrl("HTTP://cdn.example.com/x.jpg")).toBe(
      "HTTP://cdn.example.com/x.jpg",
    );
  });
});

describe("toCmsMedia", () => {
  it("keeps the fields and makes the URL absolute", () => {
    expect(
      toCmsMedia({
        id: 5,
        url: "/uploads/x.jpg",
        alternativeText: "A stage",
        width: 800,
        height: 600,
      }),
    ).toEqual({
      id: 5,
      url: "http://cms.test/uploads/x.jpg",
      alt: "A stage",
      width: 800,
      height: 600,
    });
  });

  it("turns empty or missing fields into null", () => {
    expect(
      toCmsMedia({ id: 5, url: "/uploads/x.jpg", alternativeText: "" }),
    ).toEqual({
      id: 5,
      url: "http://cms.test/uploads/x.jpg",
      alt: null,
      width: null,
      height: null,
    });
  });
});
