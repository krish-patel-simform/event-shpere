import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import { REJECTION_REASON_MAX } from "@/src/features/organizer";
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
// The service's rules (already verified / rejected, the email) have their own tests.
jest.mock("@/src/features/organizer/server", () => ({
  organizerService: { rejectOrganizer: jest.fn() },
}));
const service = jest.mocked(organizerService);

const ORGANIZER_ID = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e32";
const PATH = `/api/admin/organizers/${ORGANIZER_ID}/reject`;
const params = { organizerId: ORGANIZER_ID };
const REASON = "Organisation appeared to be a ticket resale service.";

const rejected = {
  organizerId: ORGANIZER_ID,
  organizationName: "Pixel Garage",
  organizerFirstName: "Tanvi",
  organizerLastName: "Shah",
  rejectedAt: "2026-08-22T10:00:00.000Z",
  rejectedBy: "Test admin",
  rejectionReason: REASON,
  rejectionEmailQueued: true,
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.admin);
  service.rejectOrganizer.mockResolvedValue(rejected);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/admin/organizers/[organizerId]/reject", () => {
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { params, body: sent, headers });

  it("rejects the applicant: 200 with the reason and who rejected", async () => {
    const res = await send({ reason: REASON });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: rejected });
  });

  it("hands the service the organizer, the signed-in admin and the trimmed reason", async () => {
    await send({ reason: `   ${REASON}  ` });

    expect(service.rejectOrganizer).toHaveBeenCalledWith(
      ORGANIZER_ID,
      users.admin.id,
      REASON,
    );
  });

  it.each([
    ["no reason", {}],
    ["a blank reason", { reason: "   " }],
    [
      "a reason that is too long",
      { reason: "x".repeat(REJECTION_REASON_MAX + 1) },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.rejectOrganizer).not.toHaveBeenCalled();
  });

  it("refuses an organizer id that is not a uuid (400)", async () => {
    const res = await call(POST, "POST", "/api/admin/organizers/nope/reject", {
      params: { organizerId: "nope" },
      body: { reason: REASON },
    });

    expect(res.status).toBe(400);
    expect(service.rejectOrganizer).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ reason: REASON });

    expect(res.status).toBe(401);
    expect(service.rejectOrganizer).not.toHaveBeenCalled();
  });

  it("refuses a caller with only ORGANIZER_MANAGE (403)", async () => {
    signInAs(userWith(["ORGANIZER_MANAGE"]));

    const res = await send({ reason: REASON });

    expect(res.status).toBe(403);
    expect(service.rejectOrganizer).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before rejecting", async () => {
    const res = await send(
      { reason: REASON },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.rejectOrganizer).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown organizer", async () => {
    service.rejectOrganizer.mockRejectedValue(
      new NotFoundError("Organizer not found"),
    );

    const res = await send({ reason: REASON });

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code when the application is already rejected", async () => {
    service.rejectOrganizer.mockRejectedValue(
      new ConflictError(
        "ORGANIZER_ALREADY_REJECTED",
        "This organizer has already been rejected",
      ),
    );

    const res = await send({ reason: REASON });

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("ORGANIZER_ALREADY_REJECTED");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send({ reason: REASON });

    expect(res.status).toBe(429);
    expect(service.rejectOrganizer).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.admin.id);
  });
});
