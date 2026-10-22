import { NextRequest } from "next/server";
import {
  clearAuthCookies,
  readRefreshTokenCookie,
} from "@/src/core/auth/server/auth-cookies";
import { revokeAuthSession } from "@/src/core/auth/server/auth-session";
import { POST } from "../route";

// Cookies and the DB stay out of the test: only the route's decisions are checked.
jest.mock("@/src/core/auth/server/auth-cookies", () => ({
  readAccessTokenCookie: jest.fn(),
  readRefreshTokenCookie: jest.fn(),
  clearAuthCookies: jest.fn(),
}));
jest.mock("@/src/core/auth/server/auth-session", () => ({
  resolveCurrentUser: jest.fn(),
  revokeAuthSession: jest.fn(),
}));
const mockReadRefreshTokenCookie = jest.mocked(readRefreshTokenCookie);
const mockClearAuthCookies = jest.mocked(clearAuthCookies);
const mockRevokeAuthSession = jest.mocked(revokeAuthSession);

function logout(headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers,
    }),
    { params: Promise.resolve({}) },
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/auth/logout", () => {
  it("revokes the session behind the refresh cookie, clears the cookies and returns 204", async () => {
    mockReadRefreshTokenCookie.mockResolvedValue("refresh-jwt");

    const res = await logout();

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(mockRevokeAuthSession).toHaveBeenCalledWith("refresh-jwt");
    expect(mockClearAuthCookies).toHaveBeenCalledTimes(1);
  });

  it("revokes before it clears, so a failed revoke never leaves the user thinking they are out", async () => {
    mockReadRefreshTokenCookie.mockResolvedValue("refresh-jwt");
    const order: string[] = [];
    mockRevokeAuthSession.mockImplementation(async () => {
      order.push("revoke");
    });
    mockClearAuthCookies.mockImplementation(async () => {
      order.push("clear");
    });

    await logout();

    expect(order).toEqual(["revoke", "clear"]);
  });

  it("with no refresh cookie (already logged out) it is still a 204 and still clears the cookies", async () => {
    mockReadRefreshTokenCookie.mockResolvedValue(undefined);

    const res = await logout();

    expect(res.status).toBe(204);
    expect(mockRevokeAuthSession).not.toHaveBeenCalled();
    expect(mockClearAuthCookies).toHaveBeenCalledTimes(1);
  });

  it("needs no access token: it works when only the refresh cookie is left", async () => {
    mockReadRefreshTokenCookie.mockResolvedValue("refresh-jwt");

    const res = await logout();

    expect(res.status).toBe(204);
  });

  it("when the session cannot be revoked: 500 and the cookies are NOT cleared", async () => {
    mockReadRefreshTokenCookie.mockResolvedValue("refresh-jwt");
    mockRevokeAuthSession.mockRejectedValue(new Error("db down"));

    const res = await logout();

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
    expect(mockClearAuthCookies).not.toHaveBeenCalled();
  });

  it("a request from another origin is blocked before anything is read (no forced logout)", async () => {
    const res = await logout({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(mockReadRefreshTokenCookie).not.toHaveBeenCalled();
    expect(mockRevokeAuthSession).not.toHaveBeenCalled();
    expect(mockClearAuthCookies).not.toHaveBeenCalled();
  });
});
