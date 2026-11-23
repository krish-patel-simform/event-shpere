import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ForbiddenError, ValidationError } from "@/src/core/http";
import type { EventCoverDto } from "@/src/features/events";
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
import { DELETE, POST } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service (Strapi upload, ownership) is faked. readImageUpload stays REAL: it is the route's
// HTTP check (multipart, declared size), built from the cms helper and the event image policy so
// the events server entry (and its database client) is never loaded.
jest.mock("@/src/features/events/server", () => {
  const { readImageUpload } = jest.requireActual<
    typeof import("@/src/features/cms/server/image-upload")
  >("@/src/features/cms/server/image-upload");
  const constants = jest.requireActual<
    typeof import("@/src/features/events/constants")
  >("@/src/features/events/constants");
  return {
    eventService: { replaceCover: jest.fn(), removeCover: jest.fn() },
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
const PATH = `/api/events/${EVENT_ID}/cover`;

const cover: EventCoverDto = {
  coverImage: {
    id: 12,
    url: "https://cms.example/uploads/cover.png",
    alt: null,
    width: 1600,
    height: 900,
  },
};

function imageForm(field = "files"): FormData {
  const form = new FormData();
  form.append(
    field,
    new File(["fake-png-bytes"], "cover.png", { type: "image/png" }),
  );
  return form;
}

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/events/[eventId]/cover", () => {
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
          ? (options.formData ?? imageForm())
          : undefined,
      body: options.body,
      headers: options.headers,
    });

  beforeEach(() => service.replaceCover.mockResolvedValue(cover));

  it("sets the cover: 200 with the new image", async () => {
    const res = await upload();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: cover });
  });

  it("streams the multipart body on to the service untouched, with its boundary, for the caller", async () => {
    let received = "";
    service.replaceCover.mockImplementation(async (_id, sent) => {
      received = await new Response(sent.body).text();
      return cover;
    });

    await upload();

    expect(service.replaceCover).toHaveBeenCalledWith(
      EVENT_ID,
      {
        body: expect.any(ReadableStream),
        contentType: expect.stringMatching(/^multipart\/form-data; boundary=/),
      },
      users.organizer,
    );
    expect(received).toContain('name="files"; filename="cover.png"');
    expect(received).toContain("fake-png-bytes");
  });

  it("refuses a body that is not multipart (400) without asking the service", async () => {
    const res = await upload({ body: { url: "https://example.com/a.png" } });

    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Send the image as multipart/form-data",
      },
    });
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("refuses a body that declares itself larger than the image limit (400) before the service", async () => {
    const res = await upload({
      headers: { "content-length": String(50 * 1024 * 1024) },
    });

    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "The image must be 4 MB or smaller",
      },
    });
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("does not look for the file field itself: a form without one reaches the service, whose 400 is passed on", async () => {
    const form = new FormData();
    form.append("caption", "no file here");
    service.replaceCover.mockRejectedValue(
      new ValidationError("Choose a JPEG, PNG or WebP image"),
    );

    const res = await upload({ formData: form });

    expect(service.replaceCover).toHaveBeenCalled();
    expect(res.status).toBe(400);
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await upload({ eventId: "nope" });

    expect(res.status).toBe(400);
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await upload();

    expect(res.status).toBe(401);
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("answers an admin with the service's 403 EVENT_READ_ONLY", async () => {
    signInAs(users.admin);
    service.replaceCover.mockRejectedValue(
      new ForbiddenError(
        "An admin can view an organizer's event but not change it",
        "EVENT_READ_ONLY",
      ),
    );

    const res = await upload();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("EVENT_READ_ONLY");
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await upload({ headers: { origin: "https://evil.example" } });

    expect(res.status).toBe(403);
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("answers 429 when the upload limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await upload();

    expect(res.status).toBe(429);
    expect(service.replaceCover).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-upload",
      users.organizer.id,
    );
  });
});

describe("DELETE /api/events/[eventId]/cover", () => {
  const remove = (
    options: { headers?: Record<string, string>; eventId?: string } = {},
  ) =>
    call(DELETE, "DELETE", PATH, {
      params: { eventId: options.eventId ?? EVENT_ID },
      headers: options.headers,
    });

  beforeEach(() => service.removeCover.mockResolvedValue({ coverImage: null }));

  it("removes the cover: 204 with an empty body", async () => {
    const res = await remove();

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(service.removeCover).toHaveBeenCalledWith(EVENT_ID, users.organizer);
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await remove({ eventId: "nope" });

    expect(res.status).toBe(400);
    expect(service.removeCover).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await remove();

    expect(res.status).toBe(401);
    expect(service.removeCover).not.toHaveBeenCalled();
  });

  it("answers an admin with the service's 403 EVENT_READ_ONLY", async () => {
    signInAs(users.admin);
    service.removeCover.mockRejectedValue(
      new ForbiddenError(
        "An admin can view an organizer's event but not change it",
        "EVENT_READ_ONLY",
      ),
    );

    const res = await remove();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("EVENT_READ_ONLY");
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await remove({ headers: { origin: "https://evil.example" } });

    expect(res.status).toBe(403);
    expect(service.removeCover).not.toHaveBeenCalled();
  });

  it("answers 429 when the write limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await remove();

    expect(res.status).toBe(429);
    expect(service.removeCover).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
