import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ForbiddenError } from "@/src/core/http";
import type { EventTabCounts } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../../__fixtures__/route-test";
import { GET } from "../route";

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
// Own vs all events is the service's rule, tested there.
jest.mock("@/src/features/events/server", () => ({
  eventService: { countOwnEvents: jest.fn() },
}));
const service = jest.mocked(eventService);

const PATH = "/api/me/events/counts";
const counts: EventTabCounts = {
  all: 5,
  draft: 1,
  published: 2,
  completed: 1,
  cancelled: 1,
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.countOwnEvents.mockResolvedValue(counts);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/me/events/counts", () => {
  it("answers how many events each tab holds", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: counts });
  });

  it("keeps the answer out of every cache (it depends on who asks)", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("asks the service for the caller's counts, whatever the query says", async () => {
    await call(GET, "GET", PATH, { query: { search: "summit" } });

    expect(service.countOwnEvents).toHaveBeenCalledWith(users.organizer);
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(401);
    expect(service.countOwnEvents).not.toHaveBeenCalled();
  });

  it("passes on the service's 403 for a caller who manages no events", async () => {
    signInAs(users.user);
    service.countOwnEvents.mockRejectedValue(new ForbiddenError());

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(403);
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH);

    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-read",
      users.organizer.id,
    );
  });

  it("answers 429 with Retry-After when the read limit is reached", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(429);
    expect(service.countOwnEvents).not.toHaveBeenCalled();
  });

  it("never answers a count that breaks the contract (500)", async () => {
    service.countOwnEvents.mockResolvedValue({ ...counts, draft: -1 });

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(500);
  });
});
