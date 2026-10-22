import { NextRequest } from "next/server";
import {
  readRefreshTokenCookie,
  writeAuthCookies,
} from "@/src/core/auth/server/auth-cookies";
import {
  refreshAuthSession,
  type AuthTokens,
} from "@/src/core/auth/server/auth-session";
import { POST } from "../route";

// Cookies, tokens and the DB stay out of the test: only the route's decisions are checked.
jest.mock("@/src/core/auth/server/auth-cookies", () => ({
  readAccessTokenCookie: jest.fn(),
  readRefreshTokenCookie: jest.fn(),
  writeAuthCookies: jest.fn(),
}));
jest.mock("@/src/core/auth/server/auth-session", () => ({
  resolveCurrentUser: jest.fn(),
  refreshAuthSession: jest.fn(),
}));
const mockReadRefreshTokenCookie = jest.mocked(readRefreshTokenCookie);
const mockWriteAuthCookies = jest.mocked(writeAuthCookies);
const mockRefreshAuthSession = jest.mocked(refreshAuthSession);

const newTokens: AuthTokens = {
  accessToken: {
    token: "new-access",
    expiresAt: new Date("2026-10-21T10:15:00Z"),
  },
  refreshToken: {
    token: "new-refresh",
    expiresAt: new Date("2026-10-28T10:00:00Z"),
  },
};

function refresh(headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST",
      headers,
    }),
    { params: Promise.resolve({}) },
  );
}

beforeEach(() => {
  mockReadRefreshTokenCookie.mockReset();
  mockWriteAuthCookies.mockReset();
  mockRefreshAuthSession.mockReset();
});

describe("POST /api/auth/refresh", () => {
  it("rotates the tokens: 204 with no body, and the new pair is written to the cookies", async () => {
    mockReadRefreshTokenCookie.mockResolvedValue("old-refresh");
    mockRefreshAuthSession.mockResolvedValue(newTokens);

    const res = await refresh();

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(mockRefreshAuthSession).toHaveBeenCalledWith("old-refresh");
    expect(mockWriteAuthCookies).toHaveBeenCalledWith(newTokens);
  });

  it("without a refresh cookie: 401 and nothing is refreshed or written", async () => {
    mockReadRefreshTokenCookie.mockResolvedValue(undefined);

    const res = await refresh();

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(mockRefreshAuthSession).not.toHaveBeenCalled();
    expect(mockWriteAuthCookies).not.toHaveBeenCalled();
  });

  it("an invalid, expired or already used refresh token: 401 'Session expired' and no cookies are written", async () => {
    mockReadRefreshTokenCookie.mockResolvedValue("used-refresh");
    mockRefreshAuthSession.mockResolvedValue(null);

    const res = await refresh();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Session expired" },
    });
    expect(mockWriteAuthCookies).not.toHaveBeenCalled();
  });

  it("a request from another origin is blocked before anything is read", async () => {
    const res = await refresh({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(mockReadRefreshTokenCookie).not.toHaveBeenCalled();
    expect(mockRefreshAuthSession).not.toHaveBeenCalled();
  });
});
