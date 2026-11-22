import { resolveCurrentUser } from "@/src/core/auth/server/auth-session";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import { SAMPLE_STATES } from "@/src/features/events/__fixtures__/event-manage";
import { stateService } from "@/src/features/locations/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../__fixtures__/route-test";
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
jest.mock("@/src/features/locations/server", () => ({
  stateService: { listStates: jest.fn() },
}));
const service = jest.mocked(stateService);

const PATH = "/api/states";
const states = [...SAMPLE_STATES];

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.listStates.mockResolvedValue(states);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/states", () => {
  it("answers every state to a guest, and lets browsers and the CDN keep it for an hour", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: states });
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  it("answers the same list to a signed-in caller, without looking them up", async () => {
    signInAs(users.organizer);

    const res = await call(GET, "GET", PATH);

    expect(await body(res)).toEqual({ data: states });
    expect(resolveCurrentUser).not.toHaveBeenCalled();
  });

  it("answers an empty list as an empty array, not an error", async () => {
    service.listStates.mockResolvedValue([]);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: [] });
  });

  it("counts the caller's IP (the first x-forwarded-for entry) against the public read limit", async () => {
    await call(GET, "GET", PATH, {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });

    expect(assertRateLimit).toHaveBeenCalledWith(
      "public-read-ip",
      "203.0.113.7",
    );
  });

  it("answers 429 with Retry-After when the limit is reached, and no cache header", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.get("cache-control")).toBeNull();
    expect(service.listStates).not.toHaveBeenCalled();
  });

  it("a failure is a generic 500 that the caches are not told to keep", async () => {
    service.listStates.mockRejectedValue(new Error("db down"));

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(500);
    expect((await body(res)).error?.code).toBe("INTERNAL_ERROR");
    expect(res.headers.get("cache-control")).toBeNull();
  });

  it("never answers a state that breaks the contract (500)", async () => {
    service.listStates.mockResolvedValue([{ ...states[0], id: "gujarat" }]);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(500);
  });
});
