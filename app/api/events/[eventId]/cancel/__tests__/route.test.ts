import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import type { EventDto } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";
import {
  SAMPLE_VENUES,
  SUMMIT_ID,
} from "@/src/features/events/__fixtures__/event-manage";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../../__fixtures__/route-test";
import { POST } from "../route";

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
// Ownership and which statuses may be cancelled are the service's rules: here it is faked.
jest.mock("@/src/features/events/server", () => ({
  eventService: { cancelEvent: jest.fn() },
}));
const service = jest.mocked(eventService);

const EVENT_ID = SUMMIT_ID;
const PATH = `/api/events/${EVENT_ID}/cancel`;

const cancelled: EventDto = {
  id: EVENT_ID,
  slug: "product-engineering-summit-2026",
  title: "Product Engineering Summit 2026",
  status: "cancelled",
  startAt: "2026-12-03T03:30:00.000Z",
  endAt: "2026-12-05T12:30:00.000Z",
  timezone: "Asia/Kolkata",
  venueId: SAMPLE_VENUES[0].id,
  capacity: 600,
  ticketPrice: 0,
  currency: "INR",
  registrationOpensAt: "2026-09-12T04:30:00.000Z",
  registrationClosesAt: "2026-12-02T18:30:00.000Z",
  publishedAt: "2026-09-12T08:00:00.000Z",
  createdAt: "2026-09-01T08:00:00.000Z",
};

const cancel = (
  options: { headers?: Record<string, string>; eventId?: string } = {},
) =>
  call(POST, "POST", PATH, {
    params: { eventId: options.eventId ?? EVENT_ID },
    headers: options.headers,
  });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.cancelEvent.mockResolvedValue(cancelled);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/events/[eventId]/cancel", () => {
  it("cancels the organizer's event: 200 with the cancelled event", async () => {
    const res = await cancel();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: cancelled });
    expect(service.cancelEvent).toHaveBeenCalledWith(EVENT_ID, users.organizer);
  });

  it("refuses an admin (403: EVENT_MANAGE_ALL is not EVENT_MANAGE_OWN) without asking the service", async () => {
    signInAs(users.admin);

    const res = await cancel();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("FORBIDDEN");
    expect(service.cancelEvent).not.toHaveBeenCalled();
  });

  it("lets anyone holding EVENT_MANAGE_OWN through to the service (it checks ownership)", async () => {
    const holder = userWith(["EVENT_MANAGE_OWN"]);
    signInAs(holder);

    const res = await cancel();

    expect(res.status).toBe(200);
    expect(service.cancelEvent).toHaveBeenCalledWith(EVENT_ID, holder);
  });

  it("refuses a plain user (403)", async () => {
    signInAs(users.user);

    const res = await cancel();

    expect(res.status).toBe(403);
    expect(service.cancelEvent).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await cancel();

    expect(res.status).toBe(401);
    expect(service.cancelEvent).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await cancel({ eventId: "summit" });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.cancelEvent).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (someone else's event)", async () => {
    service.cancelEvent.mockRejectedValue(new NotFoundError("Event not found"));

    const res = await cancel();

    expect(res.status).toBe(404);
  });

  it("passes on the service's 409 with its code (a draft cannot be cancelled)", async () => {
    service.cancelEvent.mockRejectedValue(
      new ConflictError(
        "EVENT_NOT_PUBLISHED",
        "Only a published event can be cancelled",
      ),
    );

    const res = await cancel();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("EVENT_NOT_PUBLISHED");
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await cancel({ headers: { origin: "https://evil.example" } });

    expect(res.status).toBe(403);
    expect(service.cancelEvent).not.toHaveBeenCalled();
  });

  it("answers 429 when the write limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await cancel();

    expect(res.status).toBe(429);
    expect(service.cancelEvent).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
