import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ForbiddenError, NotFoundError } from "@/src/core/http";
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
} from "../../../../../__fixtures__/route-test";
import { DELETE } from "../route";

jest.mock("@/src/core/auth/server/auth-cookies", () => ({
  readAccessTokenCookie: jest.fn(),
  readRefreshTokenCookie: jest.fn(),
  clearAuthCookies: jest.fn(),
  writeAuthCookies: jest.fn(),
}));
jest.mock("@/src/core/auth/server/auth-session", () => ({
  ...jest.requireActual("@/src/core/auth/server/auth-session"),
  resolveCurrentUser: jest.fn(),
}));
jest.mock("@/src/core/http/rate-limit", () => ({ assertRateLimit: jest.fn() }));
// Whether the file is in THIS event's gallery, and ownership, are the service's rules.
jest.mock("@/src/features/events/server", () => ({
  eventService: { removeGalleryImage: jest.fn() },
}));
const service = jest.mocked(eventService);

const EVENT_ID = FINTECH_ID;
const PATH = `/api/events/${EVENT_ID}/gallery/21`;

// What is left after image 21 is removed.
const remaining: EventGalleryDto = {
  gallery: [
    {
      id: 22,
      url: "https://cms.example/uploads/crowd.webp",
      alt: "The crowd",
      width: 1200,
      height: 800,
    },
  ],
};

const remove = (
  options: {
    params?: { eventId: string; fileId: string };
    headers?: Record<string, string>;
  } = {},
) =>
  call(DELETE, "DELETE", PATH, {
    params: options.params ?? { eventId: EVENT_ID, fileId: "21" },
    headers: options.headers,
  });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.removeGalleryImage.mockResolvedValue(remaining);
});
afterEach(() => jest.restoreAllMocks());

describe("DELETE /api/events/[eventId]/gallery/[fileId]", () => {
  it("removes the image: 200 with the remaining gallery (not a 204)", async () => {
    const res = await remove();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: remaining });
  });

  it("hands the service the event, the file id as a number, and the caller", async () => {
    await remove();

    expect(service.removeGalleryImage).toHaveBeenCalledWith(
      EVENT_ID,
      21,
      users.organizer,
    );
  });

  it.each([
    ["an event id that is not a uuid", { eventId: "nope", fileId: "21" }],
    ["a file id that is not a number", { eventId: EVENT_ID, fileId: "abc" }],
    ["a file id of 0", { eventId: EVENT_ID, fileId: "0" }],
    ["a file id that is not whole", { eventId: EVENT_ID, fileId: "2.5" }],
  ])("refuses %s (400) without asking the service", async (_name, params) => {
    const res = await remove({ params });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.removeGalleryImage).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await remove();

    expect(res.status).toBe(401);
    expect(service.removeGalleryImage).not.toHaveBeenCalled();
  });

  it("answers an admin with the service's 403 EVENT_READ_ONLY", async () => {
    signInAs(users.admin);
    service.removeGalleryImage.mockRejectedValue(
      new ForbiddenError(
        "An admin can view an organizer's event but not change it",
        "EVENT_READ_ONLY",
      ),
    );

    const res = await remove();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("EVENT_READ_ONLY");
  });

  it("passes on the service's 404 (a file that is not in this event's gallery)", async () => {
    service.removeGalleryImage.mockRejectedValue(
      new NotFoundError("Image not found"),
    );

    const res = await remove();

    expect(res.status).toBe(404);
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await remove({ headers: { origin: "https://evil.example" } });

    expect(res.status).toBe(403);
    expect(service.removeGalleryImage).not.toHaveBeenCalled();
  });

  it("answers 429 when the write limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await remove();

    expect(res.status).toBe(429);
    expect(service.removeGalleryImage).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
