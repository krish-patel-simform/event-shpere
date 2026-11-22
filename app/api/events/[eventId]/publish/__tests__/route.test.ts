import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import type { EventDto } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";
import {
  FINTECH_ID,
  SAMPLE_VENUES,
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
// Ownership, readiness and the dates against the event are the service's rules: here it is faked.
jest.mock("@/src/features/events/server", () => ({
  eventService: { publishEvent: jest.fn() },
}));
const service = jest.mocked(eventService);

const EVENT_ID = FINTECH_ID;
const PATH = `/api/events/${EVENT_ID}/publish`;

const published: EventDto = {
  id: EVENT_ID,
  slug: "fintech-product-forum",
  title: "Fintech Product Forum",
  status: "published",
  startAt: "2026-12-12T04:00:00.000Z",
  endAt: "2026-12-12T12:00:00.000Z",
  timezone: "Asia/Kolkata",
  venueId: SAMPLE_VENUES[2].id,
  capacity: 250,
  ticketPrice: 0,
  currency: "INR",
  registrationOpensAt: "2026-11-23T03:30:00.000Z",
  registrationClosesAt: "2026-12-11T18:30:00.000Z",
  publishedAt: "2026-11-22T10:00:00.000Z",
  createdAt: "2026-10-30T10:00:00.000Z",
};

const dates = {
  registrationOpensAt: "2026-11-23T09:00:00+05:30",
  registrationClosesAt: "2026-12-12T00:00:00+05:30",
};

const publish = (
  sent: unknown,
  options: { headers?: Record<string, string>; eventId?: string } = {},
) =>
  call(POST, "POST", PATH, {
    params: { eventId: options.eventId ?? EVENT_ID },
    body: sent,
    headers: options.headers,
  });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.publishEvent.mockResolvedValue(published);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/events/[eventId]/publish", () => {
  it("publishes the draft: 200 with the published event", async () => {
    const res = await publish(dates);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: published });
  });

  it("hands the service the event, the caller and the registration window as Dates", async () => {
    await publish(dates);

    expect(service.publishEvent).toHaveBeenCalledWith(
      EVENT_ID,
      users.organizer,
      {
        registrationOpensAt: new Date("2026-11-23T03:30:00.000Z"),
        registrationClosesAt: new Date("2026-12-11T18:30:00.000Z"),
      },
    );
  });

  it("refuses an admin (403: EVENT_PUBLISH_ALL is not EVENT_PUBLISH_OWN) without asking the service", async () => {
    signInAs(users.admin);

    const res = await publish(dates);

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("FORBIDDEN");
    expect(service.publishEvent).not.toHaveBeenCalled();
  });

  it("needs EVENT_PUBLISH_OWN, not EVENT_MANAGE_OWN (403)", async () => {
    signInAs(userWith(["EVENT_MANAGE_OWN"]));

    const res = await publish(dates);

    expect(res.status).toBe(403);
    expect(service.publishEvent).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await publish(dates);

    expect(res.status).toBe(401);
    expect(service.publishEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["no body fields", {}],
    ["no closing date", { registrationOpensAt: dates.registrationOpensAt }],
    ["no opening date", { registrationClosesAt: dates.registrationClosesAt }],
    [
      "a date without an offset",
      { ...dates, registrationOpensAt: "2026-11-23T09:00:00" },
    ],
    [
      "a window that closes before it opens",
      {
        registrationOpensAt: dates.registrationClosesAt,
        registrationClosesAt: dates.registrationOpensAt,
      },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await publish(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.publishEvent).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await publish(dates, { eventId: "fintech" });

    expect(res.status).toBe(400);
    expect(service.publishEvent).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (someone else's event)", async () => {
    service.publishEvent.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    const res = await publish(dates);

    expect(res.status).toBe(404);
  });

  it("passes on 409 EVENT_NOT_READY with the list of what is missing", async () => {
    const details = { missing: ["description", "session"] };
    service.publishEvent.mockRejectedValue(
      new ConflictError(
        "EVENT_NOT_READY",
        "Add a description and a session first",
        details,
      ),
    );

    const res = await publish(dates);

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "EVENT_NOT_READY",
        message: "Add a description and a session first",
        details,
      },
    });
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await publish(dates, {
      headers: { origin: "https://evil.example" },
    });

    expect(res.status).toBe(403);
    expect(service.publishEvent).not.toHaveBeenCalled();
  });

  it("answers 429 when the write limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await publish(dates);

    expect(res.status).toBe(429);
    expect(service.publishEvent).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
