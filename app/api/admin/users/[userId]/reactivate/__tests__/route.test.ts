import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import { userService } from "@/src/features/users/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../../../__fixtures__/route-test";
import { POST } from "../route";

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
// The service's rule (only a suspended user) has its own tests: here it is faked.
jest.mock("@/src/features/users/server", () => ({
  userService: { reactivateUser: jest.fn() },
}));
const service = jest.mocked(userService);

const USER_ID = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e47";
const PATH = `/api/admin/users/${USER_ID}/reactivate`;
const params = { userId: USER_ID };

const reactivated = {
  id: USER_ID,
  firstName: "Dev",
  lastName: "Verma",
  status: "active" as const,
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.admin);
  service.reactivateUser.mockResolvedValue(reactivated);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/admin/users/[userId]/reactivate", () => {
  const send = (headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { params, headers });

  it("lets the user back in: 200 with the new status", async () => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: reactivated });
    expect(service.reactivateUser).toHaveBeenCalledWith(USER_ID);
  });

  it("refuses a user id that is not a uuid (400)", async () => {
    const res = await call(POST, "POST", "/api/admin/users/nope/reactivate", {
      params: { userId: "nope" },
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.reactivateUser).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.reactivateUser).not.toHaveBeenCalled();
  });

  it("refuses a caller with only USER_VIEW (403)", async () => {
    signInAs(userWith(["USER_VIEW"]));

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.reactivateUser).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reactivating", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.reactivateUser).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown user", async () => {
    service.reactivateUser.mockRejectedValue(
      new NotFoundError("User not found"),
    );

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code when the user is not suspended", async () => {
    service.reactivateUser.mockRejectedValue(
      new ConflictError(
        "USER_NOT_SUSPENDED",
        "Only a suspended user can be reactivated",
      ),
    );

    const res = await send();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("USER_NOT_SUSPENDED");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.reactivateUser).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.admin.id);
  });
});
