import { SESSION_COVER_MAX_BYTES } from "../../constants";
import {
  SESSION_COVER_ACCEPT,
  SESSION_COVER_HINT,
  sessionCoverFileError,
} from "../session-cover-file";

const image = (type: string, size = 1024) =>
  new File([new Uint8Array(size)], "cover", { type });

describe("sessionCoverFileError", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("takes %s", (type) => {
    expect(sessionCoverFileError(image(type))).toBeUndefined();
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])(
    "refuses %j: only JPG, PNG and WebP",
    (type) => {
      expect(sessionCoverFileError(image(type))).toBe(
        "Choose a JPG, PNG or WebP image.",
      );
    },
  );

  it("takes an image of exactly the size limit, and refuses one byte more", () => {
    expect(
      sessionCoverFileError(image("image/png", SESSION_COVER_MAX_BYTES)),
    ).toBeUndefined();
    expect(
      sessionCoverFileError(image("image/png", SESSION_COVER_MAX_BYTES + 1)),
    ).toBe("The image must be 4 MB or smaller.");
  });

  it("says the same limits in the hint and the file picker", () => {
    expect(SESSION_COVER_HINT).toBe("JPG, PNG or WebP, up to 4 MB.");
    expect(SESSION_COVER_ACCEPT).toBe("image/jpeg,image/png,image/webp");
  });
});
