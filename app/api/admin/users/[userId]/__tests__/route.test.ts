import { assertRateLimit } from "@/src/core/http/rate-limit";
import { NotFoundError } from "@/src/core/http";
import { userService } from "@/src/features/users/server";
import {
  body,
  call,
  resetRouteMocks,
  signInAs,
  userWith,
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
jest.mock("@/src/features/users/server", () => ({
  userService: { getUserDetail: jest.fn() },
}));
const service = jest.mocked(userService);

const USER_ID = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e43";
const PATH = `/api/admin/users/${USER_ID}`;
const params = { userId: USER_ID };

const detail = {
  id: USER_ID,
  firstName: "Rahul",
  lastName: "Sharma",
  email: "rahul.sharma@example.com",
  status: "active" as const,
  role: "user" as const,
  emailVerifiedAt: "2026-10-11T08:05:00.000Z",
  createdAt: "2026-10-11T08:00:00.000Z",
  hasPassword: true,
  permissions: ["PROFILE_VIEW", "REGISTRATION_CREATE"],
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.admin);
  service.getUserDetail.mockResolvedValue(detail);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/admin/users/[userId]", () => {
  it("answers the user's account, role and permissions", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: detail });
    expect(service.getUserDetail).toHaveBeenCalledWith(USER_ID);
    // The user's email: no cache may keep it.
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("never answers the password hash, even if the service returns it", async () => {
    service.getUserDetail.mockResolvedValue({
      ...detail,
      passwordHash: "$argon2id$v=19$secret",
    } as never);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: detail });
  });

  it("refuses a user id that is not a uuid (400)", async () => {
    const res = await call(GET, "GET", "/api/admin/users/nope", {
      params: { userId: "nope" },
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getUserDetail).not.toHaveBeenCalled();
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(401);
    expect(service.getUserDetail).not.toHaveBeenCalled();
  });

  it("refuses a caller without USER_VIEW (403)", async () => {
    signInAs(userWith(["USER_STATUS_MANAGE"]));

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(403);
    expect(service.getUserDetail).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown user", async () => {
    service.getUserDetail.mockRejectedValue(
      new NotFoundError("User not found"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(404);
    expect((await body(res)).error?.code).toBe("NOT_FOUND");
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH, { params });

    expect(assertRateLimit).toHaveBeenCalledWith("user-read", users.admin.id);
  });
});
