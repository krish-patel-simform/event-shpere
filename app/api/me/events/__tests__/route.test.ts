import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ForbiddenError } from "@/src/core/http";
import { SAMPLE_EVENTS } from "@/src/features/events/__fixtures__/event-manage";
import { eventService } from "@/src/features/events/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../__fixtures__/route-test";
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
// Own vs all events and the approved-organizer check are the service's rules, tested there.
jest.mock("@/src/features/events/server", () => ({
  eventService: { listOwnEvents: jest.fn() },
}));
const service = jest.mocked(eventService);

const PATH = "/api/me/events";
const rows = SAMPLE_EVENTS.slice(0, 2);
const meta = { page: 1, pageSize: 10, total: 2 };

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.listOwnEvents.mockResolvedValue({ items: [...rows], meta });
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/me/events", () => {
  it("answers one page of the caller's events with its paging meta", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: rows, meta });
  });

  it("keeps the answer out of every cache (it depends on who asks)", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("hands the service the defaults when no query is sent, and the caller", async () => {
    await call(GET, "GET", PATH);

    expect(service.listOwnEvents).toHaveBeenCalledWith(
      { page: 1, pageSize: 10, status: "all", sort: "soonest" },
      users.organizer,
    );
  });

  it("hands the service the parsed query: numbers, the tab, a trimmed search and the sort", async () => {
    await call(GET, "GET", PATH, {
      query: {
        page: "3",
        pageSize: "20",
        status: "draft",
        search: "  summit ",
        sort: "latest",
      },
    });

    expect(service.listOwnEvents).toHaveBeenCalledWith(
      {
        page: 3,
        pageSize: 20,
        status: "draft",
        search: "summit",
        sort: "latest",
      },
      users.organizer,
    );
  });

  it("lets an admin list too (the service decides they see every event)", async () => {
    signInAs(users.admin);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(service.listOwnEvents).toHaveBeenCalledWith(
      expect.anything(),
      users.admin,
    );
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(401);
    expect(service.listOwnEvents).not.toHaveBeenCalled();
  });

  it("passes on the service's 403 for a caller who manages no events", async () => {
    signInAs(users.user);
    service.listOwnEvents.mockRejectedValue(new ForbiddenError());

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("FORBIDDEN");
  });

  it.each([
    ["page 0", { page: "0" }],
    ["a page size over 50", { pageSize: "51" }],
    ["an unknown tab", { status: "archived" }],
    ["an unknown sort", { sort: "random" }],
    ["a search over 100 characters", { search: "x".repeat(101) }],
  ])("refuses %s (400) without asking the service", async (_name, query) => {
    const res = await call(GET, "GET", PATH, { query });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.listOwnEvents).not.toHaveBeenCalled();
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
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.listOwnEvents).not.toHaveBeenCalled();
  });

  it("never answers a service result that breaks the contract (500)", async () => {
    service.listOwnEvents.mockResolvedValue({
      items: [{ ...rows[0], id: "not-a-uuid" }],
      meta,
    });

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(500);
    expect((await body(res)).error?.code).toBe("INTERNAL_ERROR");
  });
});
