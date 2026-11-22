import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError } from "@/src/core/http";
import { pendingRows } from "@/src/features/organizer/__fixtures__/organizers";
import { organizerService } from "@/src/features/organizer/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../__fixtures__/route-test";
import { GET, POST } from "../route";

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
// The service's rules (email taken, setup email) have their own tests: here it is faked.
jest.mock("@/src/features/organizer/server", () => ({
  organizerService: {
    createOrganizer: jest.fn(),
    getOrganizerListItem: jest.fn(),
  },
}));
const service = jest.mocked(organizerService);

const PATH = "/api/admin/organizers";

const createdOrganizer = {
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e11",
  userId: "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d",
  firstName: "Leena",
  lastName: "Pillai",
  email: "leena@example.com",
  status: "pending" as const,
  organizationName: "Studio Forty Two",
  organizationWebsite: "https://studio42.example.com",
  isVerified: false,
  createdAt: "2026-10-12T09:00:00.000Z",
  setupEmailQueued: true,
};

const validBody = {
  firstName: "Leena",
  lastName: "Pillai",
  email: "leena@example.com",
  organizationName: "Studio Forty Two",
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.admin);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/admin/organizers", () => {
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { body: sent, headers });

  beforeEach(() => service.createOrganizer.mockResolvedValue(createdOrganizer));

  it("creates the pending organizer: 201 with the new account", async () => {
    const res = await send({
      ...validBody,
      organizationWebsite: "https://studio42.example.com",
    });

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: createdOrganizer });
  });

  it("hands the service the trimmed names and the lower-cased email", async () => {
    await send({
      firstName: "  Leena ",
      lastName: " Pillai",
      email: "  Leena@Example.COM ",
      organizationName: " Studio Forty Two ",
    });

    expect(service.createOrganizer).toHaveBeenCalledWith({
      firstName: "Leena",
      lastName: "Pillai",
      email: "leena@example.com",
      organizationName: "Studio Forty Two",
    });
  });

  it.each([
    ["no email", { ...validBody, email: undefined }],
    ["an email that is not an email", { ...validBody, email: "leena" }],
    ["a blank first name", { ...validBody, firstName: "   " }],
    ["no organisation name", { ...validBody, organizationName: undefined }],
    [
      "a website that is not http(s)",
      { ...validBody, organizationWebsite: "javascript:alert(1)" },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.createOrganizer).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send(validBody);

    expect(res.status).toBe(401);
    expect(service.createOrganizer).not.toHaveBeenCalled();
  });

  it("refuses a caller without ORGANIZER_CREATE (403), even one who may manage organizers", async () => {
    signInAs(userWith(["ORGANIZER_MANAGE", "ORGANIZER_VERIFY"]));

    const res = await send(validBody);

    expect(res.status).toBe(403);
    expect(service.createOrganizer).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(validBody, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.createOrganizer).not.toHaveBeenCalled();
  });

  it("passes on the service's 409 when the email is taken", async () => {
    service.createOrganizer.mockRejectedValue(
      new ConflictError(
        "EMAIL_TAKEN",
        "An account with this email already exists",
      ),
    );

    const res = await send(validBody);

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "EMAIL_TAKEN",
        message: "An account with this email already exists",
      },
    });
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send(validBody);

    expect(res.status).toBe(429);
    expect(service.createOrganizer).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.admin.id);
  });
});

describe("GET /api/admin/organizers", () => {
  const meta = { page: 1, pageSize: 10, total: 4 };

  beforeEach(() => {
    service.getOrganizerListItem.mockResolvedValue({
      items: pendingRows,
      meta,
    });
  });

  it("answers a page of organizers with its paging meta", async () => {
    const res = await call(GET, "GET", PATH, { query: { pageSize: "10" } });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: pendingRows, meta });
  });

  it("hands the service the parsed query, with defaults and emailVerified as a boolean", async () => {
    await call(GET, "GET", PATH, {
      query: {
        pageSize: "20",
        search: "  acme ",
        verification: "pending",
        emailVerified: "false",
      },
    });

    expect(service.getOrganizerListItem).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      search: "acme",
      verification: "pending",
      emailVerified: false,
      sort: "newest",
    });
  });

  it.each([
    ["an unknown sort", { pageSize: "10", sort: "random" }],
    ["a page size over 50", { pageSize: "51" }],
    [
      "an unknown verification filter",
      { pageSize: "10", verification: "maybe" },
    ],
    [
      "emailVerified that is not true or false",
      { pageSize: "10", emailVerified: "1" },
    ],
  ])("refuses %s (400) without asking the service", async (_name, query) => {
    const res = await call(GET, "GET", PATH, { query });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getOrganizerListItem).not.toHaveBeenCalled();
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { query: { pageSize: "10" } });

    expect(res.status).toBe(401);
    expect(service.getOrganizerListItem).not.toHaveBeenCalled();
  });

  it("refuses an organizer (403): the list is for admins", async () => {
    signInAs(users.organizer);

    const res = await call(GET, "GET", PATH, { query: { pageSize: "10" } });

    expect(res.status).toBe(403);
    expect(service.getOrganizerListItem).not.toHaveBeenCalled();
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH, { query: { pageSize: "10" } });

    expect(assertRateLimit).toHaveBeenCalledWith("user-read", users.admin.id);
  });
});
