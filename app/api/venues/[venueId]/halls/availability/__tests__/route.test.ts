import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ForbiddenError, NotFoundError } from "@/src/core/http";
import type { HallAvailabilityDto } from "@/src/features/venues";
import { hallAvailabilityService } from "@/src/features/venues/server";
import { hallIds, venueId } from "@/src/features/venues/__fixtures__/venues";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../../../__fixtures__/route-test";
import { GET } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rules (overlaps, own session hidden) have their own tests: faked here.
jest.mock("@/src/features/venues/server", () => ({
  hallAvailabilityService: { getHallAvailability: jest.fn() },
}));
const service = jest.mocked(hallAvailabilityService);

const PATH = `/api/venues/${venueId}/halls/availability`;
const params = { venueId };
const START = "2026-12-12T09:00:00+05:30";
const END = "2026-12-13T18:00:00+05:30";
const SESSION_ID = "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e01";

const halls: HallAvailabilityDto[] = [
  {
    id: hallIds.main,
    name: "Main Auditorium",
    capacity: 300,
    busy: true,
    bookedSlots: [
      {
        startAt: "2026-12-12T04:30:00.000Z",
        endAt: "2026-12-12T05:15:00.000Z",
      },
    ],
  },
  {
    id: hallIds.workshop,
    name: "Workshop Room 1",
    capacity: 80,
    busy: false,
    bookedSlots: [],
  },
];

const ask = (query: Record<string, string> = { startAt: START, endAt: END }) =>
  call(GET, "GET", PATH, { params, query });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.getHallAvailability.mockResolvedValue(halls);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/venues/[venueId]/halls/availability", () => {
  it("answers the venue's halls with the times they are taken", async () => {
    const res = await ask();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: halls });
  });

  it("hands the service the venue, the range as dates and the caller", async () => {
    await ask({ startAt: START, endAt: END, exceptSessionId: SESSION_ID });

    expect(service.getHallAvailability).toHaveBeenCalledWith(
      venueId,
      {
        startAt: new Date("2026-12-12T03:30:00.000Z"),
        endAt: new Date("2026-12-13T12:30:00.000Z"),
        exceptSessionId: SESSION_ID,
      },
      users.organizer,
    );
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await ask();

    expect(res.status).toBe(401);
    expect(service.getHallAvailability).not.toHaveBeenCalled();
  });

  it.each([
    ["an admin", users.admin],
    ["a user", users.user],
  ])("refuses %s without EVENT_CREATE (403)", async (_name, user) => {
    signInAs(user);

    const res = await ask();

    expect(res.status).toBe(403);
    expect(service.getHallAvailability).not.toHaveBeenCalled();
  });

  it.each([
    ["no range", {}],
    [
      "a start without a time zone offset",
      { startAt: "2026-12-12T09:00:00", endAt: END },
    ],
    ["an end before the start", { startAt: END, endAt: START }],
    ["an end equal to the start", { startAt: START, endAt: START }],
    [
      "a range over 31 days",
      { startAt: "2026-12-01T00:00:00Z", endAt: "2027-01-01T00:00:01Z" },
    ],
    [
      "a session id that is not a uuid",
      { startAt: START, endAt: END, exceptSessionId: "s1" },
    ],
    ["a start that is not a date", { startAt: "tomorrow", endAt: END }],
  ])("refuses %s (400) without asking the service", async (_name, query) => {
    const res = await ask(query);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getHallAvailability).not.toHaveBeenCalled();
  });

  it("refuses a venue id that is not a uuid (400)", async () => {
    const res = await call(GET, "GET", "/api/venues/nope/halls/availability", {
      params: { venueId: "nope" },
      query: { startAt: START, endAt: END },
    });

    expect(res.status).toBe(400);
    expect(service.getHallAvailability).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown venue", async () => {
    service.getHallAvailability.mockRejectedValue(
      new NotFoundError("Venue not found"),
    );

    const res = await ask();

    expect(res.status).toBe(404);
  });

  it("passes on the service's 403 for an organizer not approved yet", async () => {
    service.getHallAvailability.mockRejectedValue(new ForbiddenError());

    const res = await ask();

    expect(res.status).toBe(403);
  });

  it("counts the caller against the read limit", async () => {
    await ask();

    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-read",
      users.organizer.id,
    );
  });

  it("answers 429 with Retry-After when the read limit is reached", async () => {
    rateLimited();

    const res = await ask();

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.getHallAvailability).not.toHaveBeenCalled();
  });

  it("never says what is booked in a hall or by whom (extra fields are dropped)", async () => {
    service.getHallAvailability.mockResolvedValue([
      {
        ...halls[0],
        bookedSlots: [
          {
            ...halls[0].bookedSlots[0],
            sessionTitle: "Secret launch",
            organizerId: users.organizer.id,
          } as never,
        ],
      },
    ]);

    const res = await ask();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: [halls[0]] });
  });
});
