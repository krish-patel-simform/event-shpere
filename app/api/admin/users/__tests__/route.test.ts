import { assertRateLimit } from "@/src/core/http/rate-limit";
import { userRows } from "@/src/features/users/__fixtures__/users";
import { userService } from "@/src/features/users/server";
import {
  body,
  call,
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
// The query → repository mapping has its own tests: here the service is faked.
jest.mock("@/src/features/users/server", () => ({
  userService: { getUsers: jest.fn() },
}));
const service = jest.mocked(userService);

const PATH = "/api/admin/users";
const meta = { page: 1, pageSize: 10, total: userRows.length };

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.admin);
  service.getUsers.mockResolvedValue({ items: userRows, meta });
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/admin/users", () => {
  it("answers a page of users with its paging meta", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: userRows, meta });
    // Emails: no cache may keep it.
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("hands the service the defaults when nothing is asked", async () => {
    await call(GET, "GET", PATH);

    expect(service.getUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      sort: "newest",
    });
  });

  it("hands the service the parsed filters, sort and page", async () => {
    await call(GET, "GET", PATH, {
      query: {
        page: "3",
        pageSize: "25",
        role: "speaker",
        status: "pending",
        search: "  meera ",
        sort: "name",
      },
    });

    expect(service.getUsers).toHaveBeenCalledWith({
      page: 3,
      pageSize: 25,
      role: "speaker",
      status: "pending",
      search: "meera",
      sort: "name",
    });
  });

  it.each([
    ["an unknown sort", { sort: "email" }],
    ["an unknown role", { role: "superuser" }],
    ["an unknown status", { status: "deleted" }],
    ["page 0", { page: "0" }],
    ["a page size over 50", { pageSize: "51" }],
  ])("refuses %s (400) without asking the service", async (_name, query) => {
    const res = await call(GET, "GET", PATH, { query });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getUsers).not.toHaveBeenCalled();
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(401);
    expect(service.getUsers).not.toHaveBeenCalled();
  });

  it("refuses a caller without USER_VIEW (403): the rows hold emails", async () => {
    signInAs(userWith(["USER_STATUS_MANAGE", "ORGANIZER_MANAGE"]));

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(403);
    expect(service.getUsers).not.toHaveBeenCalled();
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH);

    expect(assertRateLimit).toHaveBeenCalledWith("user-read", users.admin.id);
  });
});
