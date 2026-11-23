import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/src/core/http";
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

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rules (not yourself, not an admin, only active) have their own tests.
jest.mock("@/src/features/users/server", () => ({
  userService: { suspendUser: jest.fn() },
}));
const service = jest.mocked(userService);

const USER_ID = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e43";
const PATH = `/api/admin/users/${USER_ID}/suspend`;
const params = { userId: USER_ID };

const suspended = {
  id: USER_ID,
  firstName: "Rahul",
  lastName: "Sharma",
  status: "suspended" as const,
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.admin);
  service.suspendUser.mockResolvedValue(suspended);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/admin/users/[userId]/suspend", () => {
  const send = (headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { params, headers });

  it("suspends the user: 200 with the new status", async () => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: suspended });
  });

  it("hands the service the user and the signed-in admin (to refuse suspending yourself)", async () => {
    await send();

    expect(service.suspendUser).toHaveBeenCalledWith(USER_ID, users.admin.id);
  });

  it("refuses a user id that is not a uuid (400)", async () => {
    const res = await call(POST, "POST", "/api/admin/users/nope/suspend", {
      params: { userId: "nope" },
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.suspendUser).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.suspendUser).not.toHaveBeenCalled();
  });

  it("refuses a caller with only USER_VIEW (403)", async () => {
    signInAs(userWith(["USER_VIEW"]));

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.suspendUser).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before suspending", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.suspendUser).not.toHaveBeenCalled();
  });

  it("passes on the service's 403 with its code (an administrator)", async () => {
    service.suspendUser.mockRejectedValue(
      new ForbiddenError(
        "An administrator cannot be suspended",
        "CANNOT_SUSPEND_ADMIN",
      ),
    );

    const res = await send();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("CANNOT_SUSPEND_ADMIN");
  });

  it("passes on the service's 404 for an unknown user", async () => {
    service.suspendUser.mockRejectedValue(new NotFoundError("User not found"));

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code when the user is not active", async () => {
    service.suspendUser.mockRejectedValue(
      new ConflictError(
        "USER_NOT_ACTIVE",
        "Only an active user can be suspended",
      ),
    );

    const res = await send();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("USER_NOT_ACTIVE");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.suspendUser).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.admin.id);
  });
});
