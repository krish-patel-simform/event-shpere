import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, ForbiddenError } from "@/src/core/http";
import type { EventGalleryDto } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";
import { FINTECH_ID } from "@/src/features/events/__fixtures__/event-manage";
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
// The service (Strapi upload, the 10-image rule, ownership) is faked. readImageUpload stays REAL:
// it is the route's HTTP check, built from the cms helper and the event image policy so the events
// server entry (and its database client) is never loaded.
jest.mock("@/src/features/events/server", () => {
  const { readImageUpload } = jest.requireActual<
    typeof import("@/src/features/cms/server/image-upload")
  >("@/src/features/cms/server/image-upload");
  const constants = jest.requireActual<
    typeof import("@/src/features/events/constants")
  >("@/src/features/events/constants");
  return {
    eventService: { addGalleryImages: jest.fn() },
    readImageUpload: (req: Request) =>
      readImageUpload(req, {
        types: constants.EVENT_IMAGE_TYPES,
        maxBytes: constants.EVENT_IMAGE_MAX_BYTES,
        maxBodyBytes: constants.EVENT_IMAGE_MAX_BODY_BYTES,
      }),
  };
});
const service = jest.mocked(eventService);

const EVENT_ID = FINTECH_ID;
const PATH = `/api/events/${EVENT_ID}/gallery`;

const gallery: EventGalleryDto = {
  gallery: [
    {
      id: 21,
      url: "https://cms.example/uploads/stage.jpg",
      alt: null,
      width: 1200,
      height: 800,
    },
    {
      id: 22,
      url: "https://cms.example/uploads/crowd.webp",
      alt: "The crowd",
      width: 1200,
      height: 800,
    },
  ],
};

function twoImages(): FormData {
  const form = new FormData();
  form.append(
    "files",
    new File(["stage-bytes"], "stage.jpg", { type: "image/jpeg" }),
  );
  form.append(
    "files",
    new File(["crowd-bytes"], "crowd.webp", { type: "image/webp" }),
  );
  return form;
}

const upload = (
  options: {
    formData?: FormData;
    body?: unknown;
    headers?: Record<string, string>;
    eventId?: string;
  } = {},
) =>
  call(POST, "POST", PATH, {
    params: { eventId: options.eventId ?? EVENT_ID },
    formData:
      options.body === undefined
        ? (options.formData ?? twoImages())
        : undefined,
    body: options.body,
    headers: options.headers,
  });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.addGalleryImages.mockResolvedValue(gallery);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/events/[eventId]/gallery", () => {
  it("adds the images: 200 with the whole gallery", async () => {
    const res = await upload();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: gallery });
  });

  it("streams every file of the multipart body on to the service, for the caller", async () => {
    let received = "";
    service.addGalleryImages.mockImplementation(async (_id, sent) => {
      received = await new Response(sent.body).text();
      return gallery;
    });

    await upload();

    expect(service.addGalleryImages).toHaveBeenCalledWith(
      EVENT_ID,
      {
        body: expect.any(ReadableStream),
        contentType: expect.stringMatching(/^multipart\/form-data; boundary=/),
      },
      users.organizer,
    );
    expect(received).toContain('filename="stage.jpg"');
    expect(received).toContain('filename="crowd.webp"');
  });

  it("refuses a body that is not multipart (400) without asking the service", async () => {
    const res = await upload({ body: { files: ["stage.jpg"] } });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.addGalleryImages).not.toHaveBeenCalled();
  });

  it("refuses a body that declares itself larger than the limit (400) before the service", async () => {
    const res = await upload({
      headers: { "content-length": String(50 * 1024 * 1024) },
    });

    expect(res.status).toBe(400);
    expect(service.addGalleryImages).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await upload({ eventId: "nope" });

    expect(res.status).toBe(400);
    expect(service.addGalleryImages).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await upload();

    expect(res.status).toBe(401);
    expect(service.addGalleryImages).not.toHaveBeenCalled();
  });

  it("answers an admin with the service's 403 EVENT_READ_ONLY", async () => {
    signInAs(users.admin);
    service.addGalleryImages.mockRejectedValue(
      new ForbiddenError(
        "An admin can view an organizer's event but not change it",
        "EVENT_READ_ONLY",
      ),
    );

    const res = await upload();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("EVENT_READ_ONLY");
  });

  it("passes on the service's 409 when the gallery has no room", async () => {
    service.addGalleryImages.mockRejectedValue(
      new ConflictError("GALLERY_FULL", "The gallery holds at most 10 images"),
    );

    const res = await upload();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("GALLERY_FULL");
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await upload({ headers: { origin: "https://evil.example" } });

    expect(res.status).toBe(403);
    expect(service.addGalleryImages).not.toHaveBeenCalled();
  });

  it("answers 429 when the upload limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await upload();

    expect(res.status).toBe(429);
    expect(service.addGalleryImages).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-upload",
      users.organizer.id,
    );
  });
});
