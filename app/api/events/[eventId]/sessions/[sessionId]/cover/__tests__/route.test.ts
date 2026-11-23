import { assertRateLimit } from "@/src/core/http/rate-limit";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/src/core/http";
import { readImageUpload } from "@/src/features/cms/server/image-upload";
import {
  SESSION_COVER_FORM_FIELD,
  SESSION_COVER_MAX_BODY_BYTES,
  SESSION_COVER_MAX_BYTES,
  SESSION_COVER_TYPES,
} from "@/src/features/sessions/constants";
import {
  EVENT_ID,
  talk,
} from "@/src/features/sessions/__fixtures__/organizer-sessions";
import {
  readCoverUpload,
  sessionService,
} from "@/src/features/sessions/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../../../../__fixtures__/route-test";
import { DELETE, POST } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The server entry loads the database and Strapi clients, so it is faked whole. `readCoverUpload`
// is set back (in beforeEach) to the real HTTP check with the session cover's limits.
jest.mock("@/src/features/sessions/server", () => ({
  sessionService: { replaceCover: jest.fn(), removeCover: jest.fn() },
  readCoverUpload: jest.fn(),
}));
const service = jest.mocked(sessionService);

const SESSION_ID = talk.id;
const PATH = `/api/events/${EVENT_ID}/sessions/${SESSION_ID}/cover`;
const params = { eventId: EVENT_ID, sessionId: SESSION_ID };

const cover = {
  coverImage: {
    id: 12,
    url: "https://cdn.example.com/cover.jpg",
    alt: null,
    width: 1200,
    height: 630,
  },
};

/** A multipart body with a small PNG in the field Strapi reads. */
function coverForm(): FormData {
  const form = new FormData();
  form.append(
    SESSION_COVER_FORM_FIELD,
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "cover.png", {
      type: "image/png",
    }),
  );
  return form;
}

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  jest.mocked(readCoverUpload).mockImplementation((req) =>
    readImageUpload(req, {
      types: SESSION_COVER_TYPES,
      maxBytes: SESSION_COVER_MAX_BYTES,
      maxBodyBytes: SESSION_COVER_MAX_BODY_BYTES,
    }),
  );
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/events/[eventId]/sessions/[sessionId]/cover", () => {
  const send = (
    options: { formData?: FormData; body?: unknown } = {
      formData: coverForm(),
    },
    headers?: Record<string, string>,
  ) => call(POST, "POST", PATH, { params, ...options, headers });

  beforeEach(() => service.replaceCover.mockResolvedValue(cover));

  it("sets the cover: 200 with the new image", async () => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: cover });
  });

  it("streams the multipart body on to the service, untouched, with the caller", async () => {
    await send();

    expect(service.replaceCover).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      {
        body: expect.any(ReadableStream),
        contentType: expect.stringMatching(/^multipart\/form-data; boundary=/),
      },
      users.organizer,
    );
    // The bytes that reach the service are the form as the browser sent it.
    const [, , upload] = service.replaceCover.mock.calls[0];
    const sent = await new Response(upload.body).text();
    expect(sent).toContain(
      `name="${SESSION_COVER_FORM_FIELD}"; filename="cover.png"`,
    );
  });

  it("refuses a body that is not multipart (400) without asking the service", async () => {
    const res = await send({ body: { url: "https://example.com/x.png" } });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("refuses a request with no body at all (400)", async () => {
    const res = await send({});

    expect(res.status).toBe(400);
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("refuses a body that declares itself too big (400) before a byte moves", async () => {
    const res = await send(
      { formData: coverForm() },
      { "content-length": String(SESSION_COVER_MAX_BODY_BYTES + 1) },
    );

    expect(res.status).toBe(400);
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("passes on the service's 400 when Strapi finds no acceptable image (e.g. the file is missing)", async () => {
    service.replaceCover.mockRejectedValue(
      new ValidationError("The cover must be a JPEG, PNG or WebP image"),
    );
    const empty = new FormData();
    empty.append("other", "no file here");

    const res = await send({ formData: empty });

    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "The cover must be a JPEG, PNG or WebP image",
      },
    });
  });

  it.each([
    ["event", { eventId: "nope", sessionId: SESSION_ID }],
    ["session", { eventId: EVENT_ID, sessionId: "nope" }],
  ])("refuses a %s id that is not a uuid (400)", async (_name, bad) => {
    const res = await call(POST, "POST", PATH, {
      params: bad,
      formData: coverForm(),
    });

    expect(res.status).toBe(400);
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("refuses a plain user (403): SESSION_MANAGE is required", async () => {
    signInAs(users.user);

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("passes on the service's 403 EVENT_READ_ONLY for an admin", async () => {
    signInAs(users.admin);
    service.replaceCover.mockRejectedValue(
      new ForbiddenError(
        "Admins can view this event but not change it",
        "EVENT_READ_ONLY",
      ),
    );

    const res = await send();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("EVENT_READ_ONLY");
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await send(
      { formData: coverForm() },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.replaceCover).not.toHaveBeenCalled();
  });

  it("answers 429 under the upload limit", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.replaceCover).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-upload",
      users.organizer.id,
    );
  });
});

describe("DELETE /api/events/[eventId]/sessions/[sessionId]/cover", () => {
  const send = (headers?: Record<string, string>) =>
    call(DELETE, "DELETE", PATH, { params, headers });

  beforeEach(() => service.removeCover.mockResolvedValue({ coverImage: null }));

  it("removes the cover: 204 with no body", async () => {
    const res = await send();

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(service.removeCover).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      users.organizer,
    );
  });

  it("refuses a session id that is not a uuid (400)", async () => {
    const res = await call(DELETE, "DELETE", PATH, {
      params: { eventId: EVENT_ID, sessionId: "nope" },
    });

    expect(res.status).toBe(400);
    expect(service.removeCover).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.removeCover).not.toHaveBeenCalled();
  });

  it("refuses a plain user (403): SESSION_MANAGE is required", async () => {
    signInAs(users.user);

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.removeCover).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.removeCover).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (a session of another event)", async () => {
    service.removeCover.mockRejectedValue(
      new NotFoundError("Session not found"),
    );

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("counts the caller against the write limit", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.removeCover).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
