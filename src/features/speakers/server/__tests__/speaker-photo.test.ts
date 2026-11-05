import { isAcceptablePhoto } from "../speaker-photo";

// The Strapi clients are never loaded; the image helpers are pure, so the real ones are kept.
jest.mock("../../../cms/server", () =>
  jest.requireActual("../../../cms/server/image-upload"),
);

describe("isAcceptablePhoto", () => {
  const jpeg = {
    id: 1,
    mime: "image/jpeg",
    size: 300,
    width: 800,
    height: 800,
  };

  it("accepts a real JPEG/PNG/WebP within 2 MB", () => {
    expect(isAcceptablePhoto(jpeg)).toBe(true);
    expect(isAcceptablePhoto({ ...jpeg, mime: "image/png" })).toBe(true);
    expect(isAcceptablePhoto({ ...jpeg, mime: "image/webp" })).toBe(true);
  });

  it("rejects a PDF even when it was named .jpg (Strapi detects the type from the bytes)", () => {
    expect(
      isAcceptablePhoto({
        ...jpeg,
        mime: "application/pdf",
        width: null,
        height: null,
      }),
    ).toBe(false);
  });

  it("rejects other image types such as GIF or SVG", () => {
    expect(isAcceptablePhoto({ ...jpeg, mime: "image/gif" })).toBe(false);
    expect(isAcceptablePhoto({ ...jpeg, mime: "image/svg+xml" })).toBe(false);
  });

  it("rejects a file Strapi could not read as an image (no dimensions)", () => {
    expect(isAcceptablePhoto({ ...jpeg, width: null, height: null })).toBe(
      false,
    );
  });

  it("rejects more than 2 MB (Strapi reports size in KB)", () => {
    expect(isAcceptablePhoto({ ...jpeg, size: 2048 })).toBe(true);
    expect(isAcceptablePhoto({ ...jpeg, size: 2048.5 })).toBe(false);
  });
});
