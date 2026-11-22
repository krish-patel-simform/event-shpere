import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import { organizerService } from "@/src/features/organizer/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../../__fixtures__/route-test";
import { DELETE, GET } from "../route";

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
// The service's rules (not found, already verified) have their own tests: here it is faked.
jest.mock("@/src/features/organizer/server", () => ({
  organizerService: {
    getOrganizerDetail: jest.fn(),
    deleteOrganizer: jest.fn(),
  },
}));
const service = jest.mocked(organizerService);

const ORGANIZER_ID = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e15";
const PATH = `/api/admin/organizers/${ORGANIZER_ID}`;
const params = { organizerId: ORGANIZER_ID };

const detail = {
  id: ORGANIZER_ID,
  organizationName: "Acme Events Pvt Ltd",
  organizationWebsite: "https://acme-events.example.com",
  appliedAt: "2026-10-20T09:15:00.000Z",
  status: "pending" as const,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  hasDuplicate: false,
  applicant: {
    userId: "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d",
    firstName: "Ananya",
    lastName: "Rao",
    email: "ananya.rao@example.com",
    emailVerifiedAt: "2026-10-20T10:00:00.000Z",
    accountStatus: "active" as const,
    role: "organizer" as const,
    createdAt: "2026-10-20T09:15:00.000Z",
  },
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.admin);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/admin/organizers/[organizerId]", () => {
  beforeEach(() => service.getOrganizerDetail.mockResolvedValue(detail));

  it("answers the application with its applicant", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: detail });
    expect(service.getOrganizerDetail).toHaveBeenCalledWith(ORGANIZER_ID);
  });

  it("refuses an organizer id that is not a uuid (400)", async () => {
    const res = await call(GET, "GET", "/api/admin/organizers/nope", {
      params: { organizerId: "nope" },
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getOrganizerDetail).not.toHaveBeenCalled();
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(401);
    expect(service.getOrganizerDetail).not.toHaveBeenCalled();
  });

  it("refuses a caller without ORGANIZER_MANAGE (403)", async () => {
    signInAs(userWith(["ORGANIZER_VERIFY", "ORGANIZER_CREATE"]));

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(403);
    expect(service.getOrganizerDetail).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown application", async () => {
    service.getOrganizerDetail.mockRejectedValue(
      new NotFoundError("Organizer not found"),
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

describe("DELETE /api/admin/organizers/[organizerId]", () => {
  const remove = (headers?: Record<string, string>) =>
    call(DELETE, "DELETE", PATH, { params, headers });

  beforeEach(() => service.deleteOrganizer.mockResolvedValue(undefined));

  it("deletes the applicant: 204 with no body", async () => {
    const res = await remove();

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(service.deleteOrganizer).toHaveBeenCalledWith(ORGANIZER_ID);
  });

  it("refuses an organizer id that is not a uuid (400)", async () => {
    const res = await call(DELETE, "DELETE", "/api/admin/organizers/nope", {
      params: { organizerId: "nope" },
    });

    expect(res.status).toBe(400);
    expect(service.deleteOrganizer).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await remove();

    expect(res.status).toBe(401);
    expect(service.deleteOrganizer).not.toHaveBeenCalled();
  });

  // Reading the application is not enough: deleting is part of the verify decision.
  it("refuses a caller with only ORGANIZER_MANAGE (403)", async () => {
    signInAs(userWith(["ORGANIZER_MANAGE"]));

    const res = await remove();

    expect(res.status).toBe(403);
    expect(service.deleteOrganizer).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before deleting anything", async () => {
    const res = await remove({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.deleteOrganizer).not.toHaveBeenCalled();
  });

  it("passes on the service's 409 for a verified organizer", async () => {
    service.deleteOrganizer.mockRejectedValue(
      new ConflictError(
        "ORGANIZER_ALREADY_VERIFIED",
        "A verified organizer cannot be deleted",
      ),
    );

    const res = await remove();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("ORGANIZER_ALREADY_VERIFIED");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await remove();

    expect(res.status).toBe(429);
    expect(service.deleteOrganizer).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.admin.id);
  });
});
