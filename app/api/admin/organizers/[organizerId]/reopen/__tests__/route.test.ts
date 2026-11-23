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

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rule (only a rejected application) has its own tests: here it is faked.
jest.mock("@/src/features/organizer/server", () => ({
  organizerService: { reopenOrganizer: jest.fn() },
}));
const service = jest.mocked(organizerService);

const ORGANIZER_ID = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e32";
const PATH = `/api/admin/organizers/${ORGANIZER_ID}/reopen`;
const params = { organizerId: ORGANIZER_ID };

const reopened = {
  organizerId: ORGANIZER_ID,
  organizationName: "Pixel Garage",
  organizerFirstName: "Tanvi",
  organizerLastName: "Shah",
  status: "pending" as const,
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.admin);
  service.reopenOrganizer.mockResolvedValue(reopened);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/admin/organizers/[organizerId]/reopen", () => {
  const send = (headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { params, headers });

  it("reopens the application: 200 and pending again", async () => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: reopened });
    expect(service.reopenOrganizer).toHaveBeenCalledWith(ORGANIZER_ID);
  });

  it("refuses an organizer id that is not a uuid (400)", async () => {
    const res = await call(POST, "POST", "/api/admin/organizers/nope/reopen", {
      params: { organizerId: "nope" },
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.reopenOrganizer).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.reopenOrganizer).not.toHaveBeenCalled();
  });

  it("refuses a caller with only ORGANIZER_MANAGE (403)", async () => {
    signInAs(userWith(["ORGANIZER_MANAGE"]));

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.reopenOrganizer).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reopening", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.reopenOrganizer).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown organizer", async () => {
    service.reopenOrganizer.mockRejectedValue(
      new NotFoundError("Organizer not found"),
    );

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code when the application is not rejected", async () => {
    service.reopenOrganizer.mockRejectedValue(
      new ConflictError(
        "ORGANIZER_NOT_REJECTED",
        "Only a rejected organizer can be reopened",
      ),
    );

    const res = await send();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("ORGANIZER_NOT_REJECTED");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.reopenOrganizer).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.admin.id);
  });
});
