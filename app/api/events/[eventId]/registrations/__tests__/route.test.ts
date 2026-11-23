import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import type { RegistrationDto } from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";
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
// The registration rules (open, full, already registered, speaker ticket) are the service's.
jest.mock("@/src/features/registrations/server", () => ({
  registrationService: { register: jest.fn() },
}));
const service = jest.mocked(registrationService);

const EVENT_ID = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const PATH = `/api/events/${EVENT_ID}/registrations`;

const ticket: RegistrationDto = {
  id: "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f",
  eventId: EVENT_ID,
  status: "registered",
  ticketCode: "ESEVT7K3Q9P",
  amount: 0,
  currency: "INR",
  reason: "free",
  registeredAt: "2026-11-01T08:00:00.000Z",
};

const register = (
  options: {
    eventId?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) =>
  call(POST, "POST", PATH, {
    params: { eventId: options.eventId ?? EVENT_ID },
    body: options.body,
    headers: options.headers,
  });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.user);
  service.register.mockResolvedValue(ticket);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/events/[eventId]/registrations", () => {
  it("registers the signed-in user: 201 with their ticket", async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: ticket });
  });

  it("registers the session's user, whatever the body says (nobody can register someone else)", async () => {
    await register({ body: { userId: users.speaker.id } });

    expect(service.register).toHaveBeenCalledWith(EVENT_ID, users.user);
  });

  it("lets a speaker register (complimentary ticket is the service's call)", async () => {
    signInAs(users.speaker);

    const res = await register();

    expect(res.status).toBe(201);
    expect(service.register).toHaveBeenCalledWith(EVENT_ID, users.speaker);
  });

  it("refuses an organizer (403: no REGISTRATION_CREATE) without asking the service", async () => {
    signInAs(users.organizer);

    const res = await register();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("FORBIDDEN");
    expect(service.register).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await register();

    expect(res.status).toBe(401);
    expect(service.register).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await register({ eventId: "fintech" });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.register).not.toHaveBeenCalled();
  });

  it("passes on 409 ALREADY_REGISTERED with its message", async () => {
    service.register.mockRejectedValue(
      new ConflictError(
        "ALREADY_REGISTERED",
        "You are already registered for this event",
      ),
    );

    const res = await register();

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "ALREADY_REGISTERED",
        message: "You are already registered for this event",
      },
    });
  });

  it("passes on the service's 404 (a draft or unknown event)", async () => {
    service.register.mockRejectedValue(new NotFoundError("Event not found"));

    const res = await register();

    expect(res.status).toBe(404);
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await register({ headers: { origin: "https://evil.example" } });

    expect(res.status).toBe(403);
    expect(service.register).not.toHaveBeenCalled();
  });

  it("answers 429 when the write limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await register();

    expect(res.status).toBe(429);
    expect(service.register).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.user.id);
  });

  it("never sends a field outside the ticket contract (no user id)", async () => {
    service.register.mockResolvedValue({
      ...ticket,
      userId: users.user.id,
    } as never);

    const res = await register();

    expect(res.status).toBe(201);
    expect(JSON.stringify(await body(res))).not.toContain(users.user.id);
  });
});
