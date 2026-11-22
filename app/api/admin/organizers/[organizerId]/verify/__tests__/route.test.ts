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
// The service's rules (email not verified, rejected, CMS account) have their own tests.
jest.mock("@/src/features/organizer/server", () => ({
  organizerService: { verifyOrganizer: jest.fn() },
}));
const service = jest.mocked(organizerService);

const ORGANIZER_ID = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e15";
const PATH = `/api/admin/organizers/${ORGANIZER_ID}/verify`;
const params = { organizerId: ORGANIZER_ID };

const verified = {
  organizerId: ORGANIZER_ID,
  organizationName: "Acme Events Pvt Ltd",
  organizerFirstName: "Ananya",
  organizerLastName: "Rao",
  verifiedAt: "2026-10-26T08:30:00.000Z",
  verifiedBy: "Test admin",
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.admin);
  service.verifyOrganizer.mockResolvedValue(verified);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/admin/organizers/[organizerId]/verify", () => {
  const send = (headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { params, headers });

  it("verifies the organizer: 200 with who verified and when", async () => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: verified });
  });

  it("hands the service the organizer and the signed-in admin as the verifier", async () => {
    await send();

    expect(service.verifyOrganizer).toHaveBeenCalledWith(
      ORGANIZER_ID,
      users.admin.id,
    );
  });

  it("refuses an organizer id that is not a uuid (400)", async () => {
    const res = await call(POST, "POST", "/api/admin/organizers/nope/verify", {
      params: { organizerId: "nope" },
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.verifyOrganizer).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.verifyOrganizer).not.toHaveBeenCalled();
  });

  it("refuses a caller with only ORGANIZER_MANAGE (403)", async () => {
    signInAs(userWith(["ORGANIZER_MANAGE"]));

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.verifyOrganizer).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before verifying", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.verifyOrganizer).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown organizer", async () => {
    service.verifyOrganizer.mockRejectedValue(
      new NotFoundError("Organizer not found"),
    );

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code when the applicant's email is not verified", async () => {
    service.verifyOrganizer.mockRejectedValue(
      new ConflictError(
        "EMAIL_NOT_VERIFIED",
        "This organizer has not verified their email yet",
      ),
    );

    const res = await send();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.verifyOrganizer).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.admin.id);
  });
});
