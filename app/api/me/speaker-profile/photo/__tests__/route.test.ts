import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ValidationError } from "@/src/core/http";
import {
  SPEAKER_PHOTO_MAX_BYTES,
  type SpeakerPhotoResponseDto,
} from "@/src/features/speakers";
import { speakerService } from "@/src/features/speakers/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../../__fixtures__/route-test";
import { POST } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// Streaming to Strapi, the byte count and "exactly one image" are the service's job.
jest.mock("@/src/features/speakers/server", () => ({
  speakerService: { replaceOwnPhoto: jest.fn() },
}));
const service = jest.mocked(speakerService);

const PATH = "/api/me/speaker-profile/photo";

const uploaded: SpeakerPhotoResponseDto = {
  photo: {
    url: "https://cms.example.test/uploads/ananya_new.png",
    alt: "Ananya Rao",
    width: 400,
    height: 400,
  },
};

/** A multipart body with a tiny PNG in the "files" field, as the profile page sends it. */
function photoForm(): FormData {
  const form = new FormData();
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  form.append("files", new File([bytes], "me.png", { type: "image/png" }));
  return form;
}

const upload = (formData: FormData, headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { formData, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.speaker);
  service.replaceOwnPhoto.mockResolvedValue(uploaded);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/me/speaker-profile/photo", () => {
  it("replaces the photo: 200 with the new image", async () => {
    const res = await upload(photoForm());

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: uploaded });
  });

  it("streams the untouched multipart body and its boundary on to the service, for the caller", async () => {
    let received = "";
    service.replaceOwnPhoto.mockImplementation(async (_userId, photo) => {
      received = await new Response(photo.body).text();
      return uploaded;
    });

    await upload(photoForm());

    expect(service.replaceOwnPhoto).toHaveBeenCalledWith(users.speaker.id, {
      body: expect.any(ReadableStream),
      contentType: expect.stringMatching(/^multipart\/form-data; boundary=/),
    });
    expect(received).toContain('name="files"; filename="me.png"');
    expect(received).toContain("Content-Type: image/png");
  });

  it("refuses a body that is not multipart (400) without asking the service", async () => {
    const res = await call(POST, "POST", PATH, {
      body: { url: "https://evil.example/x.png" },
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.replaceOwnPhoto).not.toHaveBeenCalled();
  });

  it("refuses a multipart header with no body (400)", async () => {
    const res = await call(POST, "POST", PATH, {
      headers: { "content-type": "multipart/form-data; boundary=x" },
    });

    expect(res.status).toBe(400);
    expect(service.replaceOwnPhoto).not.toHaveBeenCalled();
  });

  it("refuses a body declared larger than the photo limit (400) before streaming it", async () => {
    const res = await upload(photoForm(), {
      "content-length": String(SPEAKER_PHOTO_MAX_BYTES + 64 * 1024 + 1),
    });

    expect(res.status).toBe(400);
    expect(service.replaceOwnPhoto).not.toHaveBeenCalled();
  });

  it("passes on the service's 400 when the form holds no image", async () => {
    service.replaceOwnPhoto.mockRejectedValue(
      new ValidationError("Upload exactly one image"),
    );

    const res = await upload(new FormData());

    expect(res.status).toBe(400);
    expect(
      (await body<{ error: { message: string } }>(res)).error.message,
    ).toBe("Upload exactly one image");
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await upload(photoForm());

    expect(res.status).toBe(401);
    expect(service.replaceOwnPhoto).not.toHaveBeenCalled();
  });

  it("refuses a caller without SPEAKER_MANAGE_OWN (403)", async () => {
    signInAs(users.organizer);

    const res = await upload(photoForm());

    expect(res.status).toBe(403);
    expect(service.replaceOwnPhoto).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before anything is uploaded", async () => {
    const res = await upload(photoForm(), { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.replaceOwnPhoto).not.toHaveBeenCalled();
  });

  it("counts the caller against the upload limit", async () => {
    await upload(photoForm());

    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-upload",
      users.speaker.id,
    );
  });

  it("answers 429 with Retry-After when the upload limit is reached", async () => {
    rateLimited();

    const res = await upload(photoForm());

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.replaceOwnPhoto).not.toHaveBeenCalled();
  });

  it("never answers a photo that breaks the contract (500)", async () => {
    service.replaceOwnPhoto.mockResolvedValue({
      photo: { ...uploaded.photo, url: "not a url" },
    });

    const res = await upload(photoForm());

    expect(res.status).toBe(500);
  });
});
