import { NextRequest } from "next/server";
import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { readAccessTokenCookie } from "@/src/core/auth/server/auth-cookies";
import {
  resolveCurrentUser,
  type CurrentUser,
} from "@/src/core/auth/server/auth-session";
import { stateService } from "@/src/features/locations/server";
import { speakerService } from "@/src/features/speakers/server";
import { venueService } from "@/src/features/venues/server";
import {
  ananya,
  ananyaProfile,
} from "@/src/features/speakers/__fixtures__/speakers";
import { LIST_VENUES } from "@/src/features/venues/__fixtures__/venue-list";
import {
  giftCity,
  hallIds,
  mainAuditorium,
  venueId,
} from "@/src/features/venues/__fixtures__/venues";
import { GET as getSpeakers } from "../speakers/route";
import { GET as getSpeaker } from "../speakers/[slug]/route";
import { GET as getStates } from "../states/route";
import { GET as getVenues } from "../venues/route";
import { GET as getVenue } from "../venues/[venueId]/route";
import { GET as getHall } from "../venues/[venueId]/halls/[hallId]/route";

// Five public GET routes answer differently to an admin (more fields, retired venues) while the URL
// stays the same, so none of them may be kept by a cache. Services and sessions are faked: only
// what the routes put on the response is checked.
jest.mock("@/src/features/speakers/server", () => ({
  speakerService: { listSpeakers: jest.fn(), getSpeakerBySlug: jest.fn() },
}));
jest.mock("@/src/features/venues/server", () => ({
  venueService: {
    listVenues: jest.fn(),
    getVenueDetail: jest.fn(),
    getHallDetail: jest.fn(),
  },
}));
jest.mock("@/src/features/locations/server", () => ({
  stateService: { listStates: jest.fn() },
}));
jest.mock("@/src/core/auth/server/auth-cookies", () => ({
  readAccessTokenCookie: jest.fn(),
}));
jest.mock("@/src/core/auth/server/auth-session", () => ({
  resolveCurrentUser: jest.fn(),
}));

// The rate limiter stays out too: it would count every test against the real Redis.
jest.mock("@/src/core/http/rate-limit", () => ({ assertRateLimit: jest.fn() }));
const mockReadAccessTokenCookie = jest.mocked(readAccessTokenCookie);
const mockResolveCurrentUser = jest.mocked(resolveCurrentUser);

const admin: CurrentUser = {
  id: "d0000000-0000-4000-8000-0000000000aa",
  sessionId: "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4",
  role: "admin",
  permissions: new Set([
    PERMISSION.VENUE_MANAGE,
    PERMISSION.HALL_MANAGE,
    PERMISSION.SPEAKER_MANAGE_ALL,
  ]),
  firstName: "Admin",
  lastName: "User",
  email: "admin@example.test",
};

const meta = { page: 1, pageSize: 10, total: 1 };
const hall = {
  ...mainAuditorium,
  createdAt: "2026-10-01T09:00:00.000Z",
  venue: {
    id: venueId,
    name: giftCity.name,
    city: giftCity.city,
    isActive: true,
  },
};

/** The five routes, each called the way Next calls it. */
const routes = [
  {
    name: "GET /api/speakers",
    call: () =>
      getSpeakers(new NextRequest("http://localhost/api/speakers"), {
        params: Promise.resolve({}),
      }),
  },
  {
    name: "GET /api/speakers/[slug]",
    call: () =>
      getSpeaker(
        new NextRequest(`http://localhost/api/speakers/${ananya.slug}`),
        { params: Promise.resolve({ slug: ananya.slug }) },
      ),
  },
  {
    name: "GET /api/venues",
    call: () =>
      getVenues(new NextRequest("http://localhost/api/venues"), {
        params: Promise.resolve({}),
      }),
  },
  {
    name: "GET /api/venues/[venueId]",
    call: () =>
      getVenue(new NextRequest(`http://localhost/api/venues/${venueId}`), {
        params: Promise.resolve({ venueId }),
      }),
  },
  {
    name: "GET /api/venues/[venueId]/halls/[hallId]",
    call: () =>
      getHall(
        new NextRequest(
          `http://localhost/api/venues/${venueId}/halls/${hallIds.main}`,
        ),
        { params: Promise.resolve({ venueId, hallId: hallIds.main }) },
      ),
  },
];

function signInAsAdmin() {
  mockReadAccessTokenCookie.mockResolvedValue("access-token");
  mockResolveCurrentUser.mockResolvedValue(admin);
}

function asGuest() {
  mockReadAccessTokenCookie.mockResolvedValue(undefined);
  mockResolveCurrentUser.mockResolvedValue(null);
}

beforeEach(() => {
  jest.resetAllMocks();
  asGuest();
  jest
    .mocked(speakerService.listSpeakers)
    .mockResolvedValue({ items: [ananya], meta });
  jest.mocked(speakerService.getSpeakerBySlug).mockResolvedValue(ananyaProfile);
  jest
    .mocked(venueService.listVenues)
    .mockResolvedValue({ items: [...LIST_VENUES], meta });
  jest.mocked(venueService.getVenueDetail).mockResolvedValue(giftCity);
  jest.mocked(venueService.getHallDetail).mockResolvedValue(hall);
  jest.mocked(stateService.listStates).mockResolvedValue([]);
});

describe.each(routes)("$name", ({ call }) => {
  it("for a guest: 200 with Cache-Control private, no-store and Vary: Cookie", async () => {
    const res = await call();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toBe("Cookie");
  });

  it("for an admin: the same two headers (they must not depend on who asks)", async () => {
    signInAsAdmin();

    const res = await call();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toBe("Cookie");
  });

  it("keeps the usual body envelope and the request id", async () => {
    const res = await call();

    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(await res.json()).toHaveProperty("data");
  });
});

describe("the lists keep their paging", () => {
  it("GET /api/speakers and GET /api/venues still return { data, meta }", async () => {
    const speakers = await routes[0].call();
    const venues = await routes[2].call();

    expect((await speakers.json()).meta).toEqual(meta);
    expect((await venues.json()).meta).toEqual(meta);
  });
});

describe("what the headers are for: the answer really does depend on the cookie", () => {
  it("tells the service whether the caller may manage (guest: false, admin: true)", async () => {
    await routes[2].call();
    signInAsAdmin();
    await routes[2].call();

    expect(
      jest.mocked(venueService.listVenues).mock.calls.map((call) => call[1]),
    ).toEqual([{ canManage: false }, { canManage: true }]);
  });
});

describe("GET /api/states (the same for everyone, so it MAY be cached)", () => {
  it("still sends its public one-hour cache, and no per-user headers", async () => {
    const res = await getStates(
      new NextRequest("http://localhost/api/states"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(res.headers.get("Vary")).toBeNull();
  });
});
