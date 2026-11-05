import {
  EVENT_GALLERY_BATCH_MAX_BYTES,
  EVENT_IMAGE_MAX_BYTES,
} from "../../constants";
import {
  addToGallerySelection,
  eventImageFileError,
} from "../event-image-file";

const MB = 1024 * 1024;

/** An image of the given size (the bytes are real, so File.size is right). */
const image = (name: string, bytes = 100, type = "image/png") =>
  new File([new Uint8Array(bytes)], name, { type, lastModified: 1 });

describe("eventImageFileError", () => {
  it("accepts an allowed type within the size", () => {
    expect(eventImageFileError(image("a.png"))).toBeUndefined();
  });

  it("refuses another type", () => {
    expect(eventImageFileError(image("a.gif", 10, "image/gif"))).toBe(
      "Choose a JPG, PNG or WebP image.",
    );
  });

  it("refuses a file over the size limit", () => {
    expect(
      eventImageFileError(image("big.png", EVENT_IMAGE_MAX_BYTES + 1)),
    ).toBe("The image must be 4 MB or smaller.");
  });
});

describe("addToGallerySelection", () => {
  it("takes every valid file, in the order chosen, after the ones already picked", () => {
    const first = image("1.png");
    const { files, error } = addToGallerySelection(
      [first],
      [image("2.png"), image("3.png")],
      10,
    );

    expect(files.map((file) => file.name)).toEqual(["1.png", "2.png", "3.png"]);
    expect(error).toBeUndefined();
  });

  it("does not change the list it was given", () => {
    const current = [image("1.png")];

    addToGallerySelection(current, [image("2.png")], 10);

    expect(current).toHaveLength(1);
  });

  it("leaves out a file that is not an allowed image, names it, and keeps the others", () => {
    const { files, error } = addToGallerySelection(
      [],
      [image("a.png"), image("b.gif", 10, "image/gif"), image("c.png")],
      10,
    );

    expect(files.map((file) => file.name)).toEqual(["a.png", "c.png"]);
    expect(error).toBe("b.gif: Choose a JPG, PNG or WebP image.");
  });

  it("takes a file picked twice once, without a message", () => {
    const { files, error } = addToGallerySelection(
      [image("a.png")],
      [image("a.png"), image("b.png")],
      10,
    );

    expect(files.map((file) => file.name)).toEqual(["a.png", "b.png"]);
    expect(error).toBeUndefined();
  });

  describe("the room left in the gallery", () => {
    it("takes only as many as fit, and says how many were left out", () => {
      const { files, error } = addToGallerySelection(
        [image("1.png")],
        [image("2.png"), image("3.png"), image("4.png")],
        3,
      );

      expect(files.map((file) => file.name)).toEqual([
        "1.png",
        "2.png",
        "3.png",
      ]);
      expect(error).toBe(
        "The gallery has room for 3 more images; 1 image left out.",
      );
    });

    it("says the gallery is full when there is no room at all", () => {
      const { files, error } = addToGallerySelection([], [image("a.png")], 0);

      expect(files).toEqual([]);
      expect(error).toBe("The gallery is full.");
    });
  });

  describe("the size one upload can carry", () => {
    it("takes images that add up to exactly the limit", () => {
      const { files, error } = addToGallerySelection(
        [],
        [
          image("a.png", EVENT_GALLERY_BATCH_MAX_BYTES / 2),
          image("b.png", EVENT_GALLERY_BATCH_MAX_BYTES / 2),
        ],
        10,
      );

      expect(files).toHaveLength(2);
      expect(error).toBeUndefined();
    });

    it("leaves out an image that would push the upload over, and says to upload in more than one go", () => {
      const { files, error } = addToGallerySelection(
        [image("a.png", 3 * MB)],
        [image("b.png", 2 * MB), image("c.png", 1 * MB)],
        10,
      );

      // c.png still fits after b.png was left out.
      expect(files.map((file) => file.name)).toEqual(["a.png", "c.png"]);
      expect(error).toMatch(/at most 4 MB of images; 1 image left out/);
      expect(error).toMatch(/Upload these first/);
    });

    it("counts the images already picked, not only the new ones", () => {
      const { files } = addToGallerySelection(
        [image("a.png", EVENT_GALLERY_BATCH_MAX_BYTES)],
        [image("b.png", 1)],
        10,
      );

      expect(files.map((file) => file.name)).toEqual(["a.png"]);
    });
  });

  it("reports every kind of problem together", () => {
    const { error } = addToGallerySelection(
      [],
      [image("x.gif", 10, "image/gif"), image("a.png"), image("b.png")],
      1,
    );

    expect(error).toContain("x.gif: Choose a JPG, PNG or WebP image.");
    expect(error).toContain("room for 1 more image; 1 image left out");
  });
});
