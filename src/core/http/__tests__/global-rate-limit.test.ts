import { NextRequest } from "next/server";
import { globalRateLimit } from "../global-rate-limit";
import { consumeRateLimit } from "../rate-limit";

// The engine and Redis stay out of the test: only what the guard asks of the limiter is checked.
jest.mock("../rate-limit", () => ({ consumeRateLimit: jest.fn() }));
const mockConsume = jest.mocked(consumeRateLimit);

const allowed = { allowed: true, remaining: 599, retryAfterSeconds: 0 };
const refused = { allowed: false, remaining: 0, retryAfterSeconds: 37 };

function api(path = "/api/events", headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

beforeEach(() => {
  mockConsume.mockReset();
  mockConsume.mockResolvedValue(allowed);
});

describe("globalRateLimit", () => {
  it("counts the request under the global-ip policy, by the caller's IP", async () => {
    await globalRateLimit(
      api("/api/events", { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
    );

    expect(mockConsume).toHaveBeenCalledWith("global-ip", "203.0.113.7");
  });

  it("lets an allowed request go on: nothing to answer", async () => {
    expect(await globalRateLimit(api())).toBeUndefined();
  });

  it("answers a refused request with a 429, Retry-After and the error envelope", async () => {
    mockConsume.mockResolvedValue(refused);

    const res = await globalRateLimit(api());

    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("37");
    expect(res?.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(await res?.json()).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests, try again later",
      },
    });
  });

  it("never counts /api/health: monitoring must always get an answer", async () => {
    mockConsume.mockResolvedValue(refused);

    expect(await globalRateLimit(api("/api/health"))).toBeUndefined();
    expect(mockConsume).not.toHaveBeenCalled();
  });

  it("only skips the exact health path, not one that merely starts like it", async () => {
    await globalRateLimit(api("/api/health-report"));

    expect(mockConsume).toHaveBeenCalledTimes(1);
  });
});
