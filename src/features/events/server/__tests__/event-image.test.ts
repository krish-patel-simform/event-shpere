import { ValidationError } from "../../../../core/http/errors";
import { EVENT_IMAGE_MAX_BODY_BYTES } from "../../constants";
import { isAcceptableEventImage, readImageUpload } from "../event-image";

// The Strapi clients are never loaded; the image helpers are pure, so the real ones are kept.
jest.mock("../../../cms/server", () =>
  jest.requireActual("../../../cms/server/image-upload"),
);

describe("readImageUpload", () => {
  const request = (headers: Record<string, string>, body?: string) =>
    new Request("http://app.test/api/events/x/cover", {
      method: "POST",
      headers,
      body,
    });

  it("hands over the stream and the original multipart content type", () => {
    const type = "multipart/form-data; boundary=abc";
    const req = request({ "content-type": type }, "--abc--");

    const upload = readImageUpload(req);

    expect(upload.contentType).toBe(type);
    expect(upload.body).toBeInstanceOf(ReadableStream);
  });

  it("refuses a body that is not multipart/form-data", () => {
    const req = request({ "content-type": "application/json" }, "{}");

    expect(() => readImageUpload(req)).toThrow(ValidationError);
  });

  it("refuses a request with no body", () => {
    const req = new Request("http://app.test/api/events/x/cover", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=abc" },
    });

    expect(() => readImageUpload(req)).toThrow(ValidationError);
  });

  it("refuses, before reading anything, a body that declares itself too big", () => {
    const req = request(
      {
        "content-type": "multipart/form-data; boundary=abc",
        "content-length": String(EVENT_IMAGE_MAX_BODY_BYTES + 1),
      },
      "--abc--",
    );

    expect(() => readImageUpload(req)).toThrow("4 MB");
  });
});

describe("isAcceptableEventImage", () => {
  const jpeg = {
    id: 1,
    mime: "image/jpeg",
    size: 300,
    width: 800,
    height: 600,
  };

  it("accepts a real JPEG/PNG/WebP within 4 MB", () => {
    expect(isAcceptableEventImage(jpeg)).toBe(true);
    expect(isAcceptableEventImage({ ...jpeg, mime: "image/png" })).toBe(true);
    expect(isAcceptableEventImage({ ...jpeg, mime: "image/webp" })).toBe(true);
  });

  it("rejects a PDF even when it was named .jpg (Strapi detects the type from the bytes)", () => {
    expect(
      isAcceptableEventImage({
        ...jpeg,
        mime: "application/pdf",
        width: null,
        height: null,
      }),
    ).toBe(false);
  });

  it("rejects other image types such as GIF or SVG", () => {
    expect(isAcceptableEventImage({ ...jpeg, mime: "image/gif" })).toBe(false);
    expect(isAcceptableEventImage({ ...jpeg, mime: "image/svg+xml" })).toBe(
      false,
    );
  });

  it("rejects a file Strapi could not read as an image (no dimensions)", () => {
    expect(isAcceptableEventImage({ ...jpeg, width: null, height: null })).toBe(
      false,
    );
  });

  it("rejects more than 4 MB (Strapi reports size in KB)", () => {
    expect(isAcceptableEventImage({ ...jpeg, size: 4096 })).toBe(true);
    expect(isAcceptableEventImage({ ...jpeg, size: 4096.5 })).toBe(false);
  });
});
