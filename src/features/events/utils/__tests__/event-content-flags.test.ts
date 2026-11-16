import { contentFlags } from "../event-content-flags";

const cover = {
  id: 1,
  url: "https://cms.example.com/uploads/c.jpg",
  alt: null,
  width: 100,
  height: 50,
};

describe("contentFlags", () => {
  it("has a description when the text is not blank", () => {
    expect(
      contentFlags({ about: "About the event", coverImage: null })
        .hasDescription,
    ).toBe(true);
  });

  it.each(["", "   ", "\n\t "])(
    "has no description for blank text (%j)",
    (about) => {
      expect(contentFlags({ about, coverImage: null }).hasDescription).toBe(
        false,
      );
    },
  );

  it("has a banner exactly when there is a cover", () => {
    expect(contentFlags({ about: "", coverImage: cover }).hasBanner).toBe(true);
    expect(contentFlags({ about: "", coverImage: null }).hasBanner).toBe(false);
  });

  it("reads the two independently", () => {
    expect(contentFlags({ about: "x", coverImage: cover })).toEqual({
      hasDescription: true,
      hasBanner: true,
    });
    expect(contentFlags({ about: "", coverImage: null })).toEqual({
      hasDescription: false,
      hasBanner: false,
    });
  });
});
