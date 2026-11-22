import { assertRateLimit } from "@/src/core/http/rate-limit";
import type { MeDto } from "@/src/features/auth";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
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

const PATH = "/api/auth/me";

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/auth/me", () => {
  it("answers who is signed in, with the role's permissions as a sorted list", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body<{ data: MeDto }>(res)).toEqual({
      data: {
        id: users.organizer.id,
        firstName: users.organizer.firstName,
        lastName: users.organizer.lastName,
        email: users.organizer.email,
        role: "organizer",
        permissions: [...users.organizer.permissions].sort(),
      },
    });
  });

  it("sorts the permissions whatever order the session holds them in", async () => {
    signInAs(userWith(["POLL_VOTE", "EVENT_CREATE", "PROFILE_VIEW"]));

    const res = await call(GET, "GET", PATH);

    expect((await body<{ data: MeDto }>(res)).data.permissions).toEqual([
      "EVENT_CREATE",
      "POLL_VOTE",
      "PROFILE_VIEW",
    ]);
  });

  it("answers no session internals (session id)", async () => {
    const res = await call(GET, "GET", PATH);

    expect(await res.text()).not.toContain(users.organizer.sessionId);
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(401);
    expect((await body(res)).error?.code).toBe("UNAUTHENTICATED");
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
  });
});
