import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import type { MyRegistrationDto } from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../../../__fixtures__/route-test";
import { DELETE, GET } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// Whose registration is read or cancelled, and when cancelling is allowed, is the service's rule.
jest.mock("@/src/features/registrations/server", () => ({
  registrationService: {
    getMyRegistration: jest.fn(),
    cancelMyRegistration: jest.fn(),
  },
}));
const service = jest.mocked(registrationService);

const EVENT_ID = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const PATH = `/api/events/${EVENT_ID}/registrations/me`;
const params = { eventId: EVENT_ID };

const ticket = {
  id: "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f",
  eventId: EVENT_ID,
  status: "registered" as const,
  ticketCode: "ESEVT7K3Q9P",
  amount: 0,
  currency: "INR",
  reason: "free" as const,
  registeredAt: "2026-11-01T08:00:00.000Z",
};

const mine: MyRegistrationDto = {
  registration: ticket,
  bookedSessionIds: ["4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f8a"],
};

const cancelled: MyRegistrationDto = {
  registration: { ...ticket, status: "cancelled" },
  bookedSessionIds: [],
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.user);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events/[eventId]/registrations/me", () => {
  beforeEach(() => service.getMyRegistration.mockResolvedValue(mine));

  it("answers the caller's own ticket and booked sessions, which no cache may keep", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: mine });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("answers a user who never registered with a null registration, not a 404", async () => {
    service.getMyRegistration.mockResolvedValue({
      registration: null,
      bookedSessionIds: [],
    });

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({
      data: { registration: null, bookedSessionIds: [] },
    });
  });

  it("hands the service the event and the signed-in user (whose ticket it is)", async () => {
    await call(GET, "GET", PATH, { params });

    expect(service.getMyRegistration).toHaveBeenCalledWith(
      EVENT_ID,
      users.user,
    );
  });

  it("refuses an organizer (403: no REGISTRATION_VIEW_OWN)", async () => {
    signInAs(users.organizer);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(403);
    expect(service.getMyRegistration).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(401);
    expect(service.getMyRegistration).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await call(GET, "GET", "/api/events/nope/registrations/me", {
      params: { eventId: "nope" },
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getMyRegistration).not.toHaveBeenCalled();
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH, { params });

    expect(assertRateLimit).toHaveBeenCalledWith("user-read", users.user.id);
  });
});

describe("DELETE /api/events/[eventId]/registrations/me", () => {
  const cancel = (
    options: { eventId?: string; headers?: Record<string, string> } = {},
  ) =>
    call(DELETE, "DELETE", PATH, {
      params: { eventId: options.eventId ?? EVENT_ID },
      headers: options.headers,
    });

  beforeEach(() => service.cancelMyRegistration.mockResolvedValue(cancelled));

  it("cancels the caller's own registration: 200 with what the GET would answer now", async () => {
    const res = await cancel();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: cancelled });
    expect(service.cancelMyRegistration).toHaveBeenCalledWith(
      EVENT_ID,
      users.user,
    );
  });

  it("refuses an organizer (403: no REGISTRATION_MANAGE_OWN)", async () => {
    signInAs(users.organizer);

    const res = await cancel();

    expect(res.status).toBe(403);
    expect(service.cancelMyRegistration).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await cancel();

    expect(res.status).toBe(401);
    expect(service.cancelMyRegistration).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await cancel({ eventId: "nope" });

    expect(res.status).toBe(400);
    expect(service.cancelMyRegistration).not.toHaveBeenCalled();
  });

  it("passes on 409 CANCELLATION_CLOSED with its code", async () => {
    service.cancelMyRegistration.mockRejectedValue(
      new ConflictError(
        "CANCELLATION_CLOSED",
        "Registration has closed, so it can no longer be cancelled",
      ),
    );

    const res = await cancel();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("CANCELLATION_CLOSED");
  });

  it("passes on the service's 404 (no registration)", async () => {
    service.cancelMyRegistration.mockRejectedValue(
      new NotFoundError("Registration not found"),
    );

    const res = await cancel();

    expect(res.status).toBe(404);
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await cancel({ headers: { origin: "https://evil.example" } });

    expect(res.status).toBe(403);
    expect(service.cancelMyRegistration).not.toHaveBeenCalled();
  });

  it("answers 429 when the write limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await cancel();

    expect(res.status).toBe(429);
    expect(service.cancelMyRegistration).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.user.id);
  });
});
