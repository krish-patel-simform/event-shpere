import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import type { SessionBookingDto } from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../../../../../__fixtures__/route-test";
import { DELETE } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The cancel rules (closing time, a used seat) have their own tests.
jest.mock("@/src/features/registrations/server", () => ({
  registrationService: { cancelSessionBooking: jest.fn() },
}));
const service = jest.mocked(registrationService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const SESSION_ID = "7b8c9d0e-1f2a-4b3c-9d4e-5f6a7b8c9d0e";
const PATH = `/api/events/${EVENT_ID}/sessions/${SESSION_ID}/registrations/me`;
const params = { eventId: EVENT_ID, sessionId: SESSION_ID };

const cancelled: SessionBookingDto = {
  id: "5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8a9b",
  sessionId: SESSION_ID,
  status: "cancelled",
  registeredAt: "2026-11-02T10:00:00.000Z",
};

const send = (headers?: Record<string, string>) =>
  call(DELETE, "DELETE", PATH, { params, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.user);
  service.cancelSessionBooking.mockResolvedValue(cancelled);
});
afterEach(() => jest.restoreAllMocks());

describe("DELETE /api/events/[eventId]/sessions/[sessionId]/registrations/me", () => {
  it("cancels the caller's own seat: 200 with the cancelled booking", async () => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: cancelled });
    expect(service.cancelSessionBooking).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      users.user,
    );
  });

  it("lets a speaker cancel their own seat too (REGISTRATION_MANAGE_OWN)", async () => {
    signInAs(users.speaker);

    const res = await send();

    expect(res.status).toBe(200);
    expect(service.cancelSessionBooking).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      users.speaker,
    );
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.cancelSessionBooking).not.toHaveBeenCalled();
  });

  it("refuses a caller without REGISTRATION_MANAGE_OWN (403): an organizer", async () => {
    signInAs(users.organizer);

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.cancelSessionBooking).not.toHaveBeenCalled();
  });

  it.each([
    ["event", { eventId: "nope", sessionId: SESSION_ID }],
    ["session", { eventId: EVENT_ID, sessionId: "nope" }],
  ])("refuses a %s id that is not a uuid (400)", async (_name, bad) => {
    const res = await call(DELETE, "DELETE", PATH, { params: bad });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.cancelSessionBooking).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.cancelSessionBooking).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (no booking)", async () => {
    service.cancelSessionBooking.mockRejectedValue(
      new NotFoundError("Booking not found"),
    );

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code (cancellation has closed)", async () => {
    service.cancelSessionBooking.mockRejectedValue(
      new ConflictError(
        "CANCELLATION_CLOSED",
        "Registration has closed, the seat can no longer be cancelled",
      ),
    );

    const res = await send();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("CANCELLATION_CLOSED");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.cancelSessionBooking).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.user.id);
  });
});
