import { NextRequest } from "next/server";
import { globalRateLimit } from "@/src/core/http/global-rate-limit";
import { config, proxy } from "../proxy";

// The limiter stays out of the test: only how proxy() uses its answer is checked.
jest.mock("@/src/core/http/global-rate-limit", () => ({
  globalRateLimit: jest.fn(),
}));
const mockGlobalRateLimit = jest.mocked(globalRateLimit);

const request = () => new NextRequest("http://localhost/api/events");

beforeEach(() => {
  mockGlobalRateLimit.mockReset();
});

describe("proxy", () => {
  it("answers with the guard's response when it refuses the request", async () => {
    const refusal = new Response(null, { status: 429 });
    mockGlobalRateLimit.mockResolvedValue(refusal);

    expect(await proxy(request())).toBe(refusal);
  });

  it("lets the request continue to the route when the guard allows it", async () => {
    mockGlobalRateLimit.mockResolvedValue(undefined);

    const res = await proxy(request());

    // NextResponse.next() marks the response "continue to the route".
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("runs only on API routes", () => {
    expect(config.matcher).toBe("/api/:path*");
  });
});
