import { assertRateLimit } from "@/src/core/http/rate-limit";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from "@/src/core/http";
import type { EventDto, EventOverviewData } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";
import {
  FINTECH_ID,
  findSampleOverview,
  SAMPLE_VENUES,
} from "@/src/features/events/__fixtures__/event-manage";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../__fixtures__/route-test";
import { DELETE, GET, PATCH } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// Ownership, admin read-only and the edit rules are the service's: here it is faked.
jest.mock("@/src/features/events/server", () => ({
  eventService: {
    getEventOverview: jest.fn(),
    updateEvent: jest.fn(),
    deleteEvent: jest.fn(),
  },
}));
const service = jest.mocked(eventService);

const EVENT_ID = FINTECH_ID;
const PATH = `/api/events/${EVENT_ID}`;
const params = { eventId: EVENT_ID };
const badParams = { eventId: "not-a-uuid" };

function sampleOverview(): EventOverviewData {
  const overview = findSampleOverview(EVENT_ID);
  if (!overview) throw new Error("The fixture has no Fintech overview");
  return overview;
}

const event: EventDto = {
  id: EVENT_ID,
  slug: "fintech-product-forum",
  title: "Fintech Product Forum",
  status: "draft",
  startAt: "2026-12-12T04:00:00.000Z",
  endAt: "2026-12-12T12:00:00.000Z",
  timezone: "Asia/Kolkata",
  venueId: SAMPLE_VENUES[2].id,
  capacity: 250,
  ticketPrice: 0,
  currency: "INR",
  registrationOpensAt: null,
  registrationClosesAt: null,
  publishedAt: null,
  createdAt: "2026-10-30T10:00:00.000Z",
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events/[eventId]", () => {
  beforeEach(() =>
    service.getEventOverview.mockResolvedValue(sampleOverview()),
  );

  it("answers the event's overview", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: sampleOverview() });
  });

  it("hands the service the event id and the caller (it decides who reaches the event)", async () => {
    signInAs(users.admin);

    await call(GET, "GET", PATH, { params });

    expect(service.getEventOverview).toHaveBeenCalledWith(
      EVENT_ID,
      users.admin,
    );
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(401);
    expect((await body(res)).error?.code).toBe("UNAUTHENTICATED");
    expect(service.getEventOverview).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await call(GET, "GET", "/api/events/not-a-uuid", {
      params: badParams,
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getEventOverview).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (someone else's event)", async () => {
    service.getEventOverview.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(404);
    expect((await body(res)).error?.code).toBe("NOT_FOUND");
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH, { params });

    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-read",
      users.organizer.id,
    );
  });
});

describe("PATCH /api/events/[eventId]", () => {
  const send = (
    sent: unknown,
    options: { headers?: Record<string, string>; eventId?: string } = {},
  ) =>
    call(PATCH, "PATCH", PATH, {
      params: { eventId: options.eventId ?? EVENT_ID },
      body: sent,
      headers: options.headers,
    });

  beforeEach(() => service.updateEvent.mockResolvedValue(event));

  it("saves the change: 200 with the event", async () => {
    const res = await send({ title: "Fintech Product Forum" });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: event });
  });

  it("hands the service only the fields sent, parsed (trimmed title, Dates, nulls kept), and the caller", async () => {
    await send({
      title: "  Fintech Forum ",
      startAt: "2026-12-12T09:30:00+05:30",
      venueId: null,
      capacity: null,
      slug: "ignored-the-slug-never-changes",
    });

    expect(service.updateEvent).toHaveBeenCalledWith(
      EVENT_ID,
      {
        title: "Fintech Forum",
        startAt: new Date("2026-12-12T04:00:00.000Z"),
        venueId: null,
        capacity: null,
      },
      users.organizer,
    );
  });

  it.each([
    ["an empty body", {}],
    ["a body with only unknown fields", { status: "published" }],
    ["a title under 3 characters", { title: "AI" }],
    [
      "an end before the start",
      {
        startAt: "2026-12-12T09:30:00+05:30",
        endAt: "2026-12-12T08:00:00+05:30",
      },
    ],
    ["a capacity of 0", { capacity: 0 }],
    ["a venue id that is not a uuid", { venueId: "hall-1" }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.updateEvent).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await send({ title: "Fintech" }, { eventId: "nope" });

    expect(res.status).toBe(400);
    expect(service.updateEvent).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ title: "Fintech" });

    expect(res.status).toBe(401);
    expect(service.updateEvent).not.toHaveBeenCalled();
  });

  it("answers an admin's edit with the service's 403 EVENT_READ_ONLY", async () => {
    signInAs(users.admin);
    service.updateEvent.mockRejectedValue(
      new ForbiddenError(
        "An admin can view an organizer's event but not change it",
        "EVENT_READ_ONLY",
      ),
    );

    const res = await send({ title: "Fintech" });

    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({
      error: {
        code: "EVENT_READ_ONLY",
        message: "An admin can view an organizer's event but not change it",
      },
    });
    expect(service.updateEvent).toHaveBeenCalledWith(
      EVENT_ID,
      { title: "Fintech" },
      users.admin,
    );
  });

  it("passes on a 409 with its code (the price is locked once someone registered)", async () => {
    service.updateEvent.mockRejectedValue(
      new ConflictError(
        "EVENT_HAS_REGISTRATIONS",
        "The price cannot change once people have registered",
      ),
    );

    const res = await send({ ticketPrice: 50000 });

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("EVENT_HAS_REGISTRATIONS");
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(
      { title: "Fintech" },
      { headers: { origin: "https://evil.example" } },
    );

    expect(res.status).toBe(403);
    expect(service.updateEvent).not.toHaveBeenCalled();
  });

  it("answers 429 when the write limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await send({ title: "Fintech" });

    expect(res.status).toBe(429);
    expect(service.updateEvent).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});

describe("DELETE /api/events/[eventId]", () => {
  const remove = (headers?: Record<string, string>) =>
    call(DELETE, "DELETE", PATH, { params, headers });

  beforeEach(() => service.deleteEvent.mockResolvedValue(undefined));

  it("deletes the organizer's draft: 204 with an empty body", async () => {
    const res = await remove();

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(service.deleteEvent).toHaveBeenCalledWith(EVENT_ID, users.organizer);
  });

  it("refuses an admin (403: EVENT_MANAGE_ALL is not EVENT_MANAGE_OWN) without asking the service", async () => {
    signInAs(users.admin);

    const res = await remove();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("FORBIDDEN");
    expect(service.deleteEvent).not.toHaveBeenCalled();
  });

  it("refuses a plain user (403)", async () => {
    signInAs(users.user);

    const res = await remove();

    expect(res.status).toBe(403);
    expect(service.deleteEvent).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await remove();

    expect(res.status).toBe(401);
    expect(service.deleteEvent).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await call(DELETE, "DELETE", "/api/events/nope", {
      params: badParams,
    });

    expect(res.status).toBe(400);
    expect(service.deleteEvent).not.toHaveBeenCalled();
  });

  it("passes on the service's 409 EVENT_NOT_DRAFT (a published event is cancelled instead)", async () => {
    service.deleteEvent.mockRejectedValue(
      new ConflictError(
        "EVENT_NOT_DRAFT",
        "Only a draft can be deleted; cancel a published event",
      ),
    );

    const res = await remove();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("EVENT_NOT_DRAFT");
  });

  it("passes on the service's 503 CMS_UNAVAILABLE", async () => {
    service.deleteEvent.mockRejectedValue(
      new ServiceUnavailableError(
        "CMS_UNAVAILABLE",
        "The event page could not be reached, nothing was deleted",
      ),
    );

    const res = await remove();

    expect(res.status).toBe(503);
    expect((await body(res)).error?.code).toBe("CMS_UNAVAILABLE");
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await remove({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.deleteEvent).not.toHaveBeenCalled();
  });

  it("answers 429 when the write limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await remove();

    expect(res.status).toBe(429);
    expect(service.deleteEvent).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
