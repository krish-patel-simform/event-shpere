import { createByteLimit, isAcceptablePhoto } from "../speaker-photo";

async function drain(stream: ReadableStream<Uint8Array>): Promise<number> {
  const reader = stream.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.byteLength;
  }
}

describe("createByteLimit", () => {
  it("passes a body under the limit through untouched", async () => {
    const limit = createByteLimit(10);

    const total = await drain(
      new Blob([new Uint8Array(8)]).stream().pipeThrough(limit.stream),
    );

    expect(total).toBe(8);
    expect(limit.exceeded()).toBe(false);
  });

  it("cuts the stream off past the limit and says so", async () => {
    const limit = createByteLimit(10);

    await expect(
      drain(new Blob([new Uint8Array(11)]).stream().pipeThrough(limit.stream)),
    ).rejects.toThrow("larger than 10 bytes");
    expect(limit.exceeded()).toBe(true);
  });
});

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
