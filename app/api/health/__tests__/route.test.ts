import { NextRequest } from "next/server";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import { GET } from "../route";

// Cookies, sessions and the limiter stay out of the test: only the route's decisions are checked.
jest.mock("@/src/core/auth/server/auth-cookies", () => ({
  readAccessTokenCookie: jest.fn(),
}));
jest.mock("@/src/core/auth/server/auth-session", () => ({
  resolveCurrentUser: jest.fn(),
}));
jest.mock("@/src/core/http/rate-limit", () => ({ assertRateLimit: jest.fn() }));
const mockAssertRateLimit = jest.mocked(assertRateLimit);

function health() {
  return GET(new NextRequest("http://localhost/api/health"), {
    params: Promise.resolve({}),
  });
}

beforeEach(() => {
  mockAssertRateLimit.mockReset();
});

describe("GET /api/health", () => {
  it("answers 200 with { data: { status: 'ok' } }", async () => {
    const res = await health();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: "ok" } });
  });

  it("is never rate limited: monitoring must always get an answer, with or without Redis", async () => {
    await health();

    expect(mockAssertRateLimit).not.toHaveBeenCalled();
  });
});
