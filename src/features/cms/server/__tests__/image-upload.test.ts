import { ValidationError } from "../../../../core/http/errors";
import type { StrapiUploadedFile } from "../../schemas/strapi-common.schemas";
import {
  createImageUploader,
  isAcceptableImage,
  readImageUpload,
  type ImagePolicy,
} from "../image-upload";

// The media client is only a type here: the env is never loaded.
jest.mock("../strapi-media.client", () => ({}));

const policy: ImagePolicy = {
  types: ["image/jpeg", "image/png"],
  maxBytes: 2 * 1024 * 1024, // 2 MB
  maxBodyBytes: 2 * 1024 * 1024 + 1024,
};

const jpeg: StrapiUploadedFile = {
  id: 31,
  mime: "image/jpeg",
  size: 100, // KB
  width: 800,
  height: 600,
};

describe("readImageUpload", () => {
  const request = (
    headers: Record<string, string>,
    body: string | null = "x",
  ) => new Request("http://app.test/upload", { method: "POST", headers, body });

  it("hands over the body and the multipart header untouched", () => {
    const req = request({
      "content-type": "multipart/form-data; boundary=abc",
    });

    const upload = readImageUpload(req, policy);

    expect(upload.contentType).toBe("multipart/form-data; boundary=abc");
    expect(upload.body).toBe(req.body);
  });

  it("refuses anything that is not multipart (400)", () => {
    const req = request({ "content-type": "application/json" });

    expect(() => readImageUpload(req, policy)).toThrow(ValidationError);
  });

  it("refuses a request without a body (400)", () => {
    const req = new Request("http://app.test/upload", {
      method: "GET",
      headers: { "content-type": "multipart/form-data; boundary=abc" },
    });

    expect(() => readImageUpload(req, policy)).toThrow(ValidationError);
  });

  it("refuses a body that declares itself too big, naming the file limit", () => {
    const req = request({
      "content-type": "multipart/form-data; boundary=abc",
      "content-length": String(policy.maxBodyBytes + 1),
    });

    expect(() => readImageUpload(req, policy)).toThrow("2 MB");
  });
});

describe("isAcceptableImage", () => {
  it("accepts an allowed type with real dimensions within the size", () => {
    expect(isAcceptableImage(jpeg, policy)).toBe(true);
    expect(isAcceptableImage({ ...jpeg, mime: "image/png" }, policy)).toBe(
      true,
    );
  });

  it("rejects a type that is not in the policy", () => {
    expect(isAcceptableImage({ ...jpeg, mime: "image/webp" }, policy)).toBe(
      false,
    );
    expect(
      isAcceptableImage({ ...jpeg, mime: "application/pdf" }, policy),
    ).toBe(false);
  });

  it("rejects a file without image dimensions (e.g. a PDF renamed to .jpg)", () => {
    expect(
      isAcceptableImage({ ...jpeg, width: null, height: null }, policy),
    ).toBe(false);
  });

  it("compares Strapi's size in KB with the limit in bytes", () => {
    expect(isAcceptableImage({ ...jpeg, size: 2048 }, policy)).toBe(true);
    expect(isAcceptableImage({ ...jpeg, size: 2048.5 }, policy)).toBe(false);
  });
});

describe("createImageUploader", () => {
  const upload = (bytes = 100) => ({
    body: new Blob([new Uint8Array(bytes)]).stream(),
    contentType: "multipart/form-data; boundary=abc",
  });
  const invalid = new ValidationError("not a good image");
  const unavailable = new Error("cms down");

  function setup() {
    const mediaClient = {
      uploadFiles: jest.fn().mockResolvedValue({ ok: true, files: [jpeg] }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const uploader = createImageUploader({
      mediaClient,
      policy,
      scope: "things",
      noun: "image",
      invalid: () => invalid,
      unavailable: () => unavailable,
    });
    return { mediaClient, ...uploader };
  }

  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it("streams the body to Strapi with the original multipart header and returns the stored image", async () => {
    const { uploadOneImage, mediaClient } = setup();

    await expect(uploadOneImage(upload())).resolves.toEqual(jpeg);

    expect(mediaClient.uploadFiles).toHaveBeenCalledWith(
      expect.any(ReadableStream),
      "multipart/form-data; boundary=abc",
    );
    expect(mediaClient.deleteFile).not.toHaveBeenCalled();
  });

  it("answers the feature's 'invalid' error when Strapi refuses the file itself", async () => {
    const { uploadOneImage, mediaClient } = setup();
    mediaClient.uploadFiles.mockResolvedValue({ ok: false, status: 415 });

    await expect(uploadOneImage(upload())).rejects.toBe(invalid);
  });

  it("deletes a stored file that is not an acceptable image, then answers 'invalid'", async () => {
    const { uploadOneImage, mediaClient } = setup();
    mediaClient.uploadFiles.mockResolvedValue({
      ok: true,
      files: [{ ...jpeg, mime: "application/pdf" }],
    });

    await expect(uploadOneImage(upload())).rejects.toBe(invalid);
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(31);
  });

  it("deletes EVERY file when more than one was sent, then answers 'invalid'", async () => {
    const { uploadOneImage, mediaClient } = setup();
    mediaClient.uploadFiles.mockResolvedValue({
      ok: true,
      files: [jpeg, { ...jpeg, id: 32 }],
    });

    await expect(uploadOneImage(upload())).rejects.toBe(invalid);
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(31);
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(32);
  });

  it("answers 'invalid' when Strapi stored no file at all", async () => {
    const { uploadOneImage, mediaClient } = setup();
    mediaClient.uploadFiles.mockResolvedValue({ ok: true, files: [] });

    await expect(uploadOneImage(upload())).rejects.toBe(invalid);
  });

  it("cuts the stream off past the limit and answers 'invalid', not 'unavailable'", async () => {
    const { uploadOneImage, mediaClient } = setup();
    // Like real fetch: reads the (size-limited) stream, which errors past the limit.
    mediaClient.uploadFiles.mockImplementation(
      async (body: ReadableStream<Uint8Array>) => {
        const reader = body.getReader();
        for (;;) {
          const { done } = await reader.read();
          if (done) return { ok: true as const, files: [jpeg] };
        }
      },
    );

    await expect(uploadOneImage(upload(policy.maxBodyBytes + 1))).rejects.toBe(
      invalid,
    );
  });

  it("answers 'unavailable' and logs when Strapi cannot be reached", async () => {
    const { uploadOneImage, mediaClient } = setup();
    mediaClient.uploadFiles.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(uploadOneImage(upload())).rejects.toBe(unavailable);
    expect(errorSpy).toHaveBeenCalledWith(
      "[things] image upload to Strapi failed:",
      "ECONNREFUSED",
    );
  });

  describe("uploadImages (a batch)", () => {
    const second: StrapiUploadedFile = { ...jpeg, id: 32 };
    const third: StrapiUploadedFile = { ...jpeg, id: 33 };

    it("returns every stored image, in the order Strapi answered", async () => {
      const { uploadImages, mediaClient } = setup();
      mediaClient.uploadFiles.mockResolvedValue({
        ok: true,
        files: [jpeg, second, third],
      });

      await expect(uploadImages(upload())).resolves.toEqual([
        jpeg,
        second,
        third,
      ]);
      expect(mediaClient.deleteFile).not.toHaveBeenCalled();
    });

    it("sends the body to Strapi once, however many files it holds", async () => {
      const { uploadImages, mediaClient } = setup();
      mediaClient.uploadFiles.mockResolvedValue({
        ok: true,
        files: [jpeg, second],
      });

      await uploadImages(upload());

      expect(mediaClient.uploadFiles).toHaveBeenCalledTimes(1);
    });

    it("deletes ALL the files when one of them is not an acceptable image: a batch is saved whole or not at all", async () => {
      const { uploadImages, mediaClient } = setup();
      mediaClient.uploadFiles.mockResolvedValue({
        ok: true,
        files: [jpeg, { ...second, mime: "application/pdf" }, third],
      });

      await expect(uploadImages(upload())).rejects.toBe(invalid);
      expect(mediaClient.deleteFile.mock.calls.map(([id]) => id)).toEqual([
        31, 32, 33,
      ]);
    });

    it("answers with the feature's batch wording when it is given one", async () => {
      const { uploadImages, mediaClient } = setup();
      const batchInvalid = new ValidationError("not good images");
      mediaClient.uploadFiles.mockResolvedValue({ ok: false, status: 415 });

      await expect(uploadImages(upload(), () => batchInvalid)).rejects.toBe(
        batchInvalid,
      );
    });

    it("holds the WHOLE body, all files together, to the body limit", async () => {
      const { uploadImages, mediaClient } = setup();
      mediaClient.uploadFiles.mockImplementation(
        async (body: ReadableStream<Uint8Array>) => {
          const reader = body.getReader();
          for (;;) {
            const { done } = await reader.read();
            if (done) return { ok: true as const, files: [jpeg, second] };
          }
        },
      );

      await expect(
        uploadImages(upload(policy.maxBodyBytes + 1), () => invalid),
      ).rejects.toBe(invalid);
    });

    it("answers 'invalid' when Strapi stored nothing", async () => {
      const { uploadImages, mediaClient } = setup();
      mediaClient.uploadFiles.mockResolvedValue({ ok: true, files: [] });

      await expect(uploadImages(upload())).rejects.toBe(invalid);
    });
  });

  describe("removeUploadedFile", () => {
    it("deletes the file", async () => {
      const { removeUploadedFile, mediaClient } = setup();

      await removeUploadedFile(7);

      expect(mediaClient.deleteFile).toHaveBeenCalledWith(7);
    });

    it("never throws: a file left behind only takes space, and is logged", async () => {
      const { removeUploadedFile, mediaClient } = setup();
      mediaClient.deleteFile.mockRejectedValue(new Error("boom"));

      await expect(removeUploadedFile(7)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        "[things] Strapi file 7 not deleted:",
        "boom",
      );
    });
  });
});
