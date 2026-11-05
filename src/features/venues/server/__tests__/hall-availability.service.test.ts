import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../../core/http/errors";
import type { Hall } from "../../../../db/schemas";
import { hallAvailabilityResponseSchema } from "../../schemas/hall-availability.schemas";
import { createHallAvailabilityService } from "../hall-availability.service";
import type { VenueWithState } from "../venue.repository";

// Empty factories: the DB client and env are never loaded.
jest.mock("../venue.repository", () => ({}));
jest.mock("../../../organizer/server", () => ({}));
jest.mock("../../../sessions/server", () => ({}));

const createdAt = new Date("2026-10-30T10:00:00.000Z");
const venueId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const organizer = {
  id: "5d1c3a4b-7e8f-4a1b-9c2d-3e4f5a6b7c8d",
  role: "organizer" as const,
};

const query = {
  startAt: new Date("2026-12-12T03:30:00.000Z"), // 09:00 IST
  endAt: new Date("2026-12-12T11:30:00.000Z"), // 17:00 IST
};

const venue = (overrides: Partial<VenueWithState> = {}): VenueWithState => ({
  id: venueId,
  name: "Convention Centre",
  addressLine: "Plot 4, Senapati Bapat Road",
  city: "Pune",
  stateId: "3b7c2d1e-6f5a-4e8d-9a0b-1c2d3e4f5a6b",
  stateName: "Maharashtra",
  postalCode: null,
  country: "IN",
  timezone: "Asia/Kolkata",
  latitude: null,
  longitude: null,
  isActive: true,
  createdBy: organizer.id,
  createdAt,
  updatedAt: createdAt,
  ...overrides,
});

const hall = (
  id: string,
  name: string,
  capacity: number,
  isActive = true,
): Hall => ({
  id,
  venueId,
  name,
  capacity,
  sortOrder: 0,
  isActive,
  createdAt,
  updatedAt: createdAt,
});

const hallA = "aaaaaaaa-0000-4000-8000-000000000001";
const hallB = "aaaaaaaa-0000-4000-8000-000000000002";
const hallC = "aaaaaaaa-0000-4000-8000-000000000003";

const halls = [
  hall(hallA, "Hall A", 300),
  hall(hallB, "Hall B", 150),
  hall(hallC, "Hall C (switched off)", 80, false),
];

function setup(found: { venue: VenueWithState; halls: Hall[] } | null) {
  const deps = {
    venueRepository: { getVenueById: jest.fn().mockResolvedValue(found) },
    hallBooking: { findHeldSlots: jest.fn().mockResolvedValue([]) },
    organizerVerification: {
      assertVerifiedOrganizer: jest.fn().mockResolvedValue("profile-id"),
    },
  };
  return { deps, service: createHallAvailabilityService(deps) };
}

describe("hallAvailabilityService.getHallAvailability", () => {
  it("lists the active halls of the venue, all free when nothing is booked", async () => {
    const { service } = setup({ venue: venue(), halls });

    const result = await service.getHallAvailability(venueId, query, organizer);

    expect(result).toEqual([
      {
        id: hallA,
        name: "Hall A",
        capacity: 300,
        busy: false,
        bookedSlots: [],
      },
      {
        id: hallB,
        name: "Hall B",
        capacity: 150,
        busy: false,
        bookedSlots: [],
      },
    ]);
    expect(() => hallAvailabilityResponseSchema.parse(result)).not.toThrow();
  });

  it("leaves out a hall that is switched off: it cannot take sessions", async () => {
    const { service } = setup({ venue: venue(), halls });

    const result = await service.getHallAvailability(venueId, query, organizer);

    expect(result.map((item) => item.id)).not.toContain(hallC);
  });

  it("asks for all the halls in ONE query, with the range, and only the active ones", async () => {
    const { service, deps } = setup({ venue: venue(), halls });

    await service.getHallAvailability(venueId, query, organizer);

    expect(deps.hallBooking.findHeldSlots).toHaveBeenCalledTimes(1);
    expect(deps.hallBooking.findHeldSlots).toHaveBeenCalledWith({
      hallIds: [hallA, hallB],
      startAt: query.startAt,
      endAt: query.endAt,
    });
  });

  it("marks a hall busy when it is only PARTLY taken, and says which times", async () => {
    const { service, deps } = setup({ venue: venue(), halls });
    // Hall B has one session from 10:00 to 12:00 IST inside the 09:00-17:00 range.
    deps.hallBooking.findHeldSlots.mockResolvedValue([
      {
        hallId: hallB,
        startAt: new Date("2026-12-12T04:30:00.000Z"),
        endAt: new Date("2026-12-12T06:30:00.000Z"),
      },
    ]);

    const result = await service.getHallAvailability(venueId, query, organizer);

    expect(result.find((item) => item.id === hallA)).toMatchObject({
      busy: false,
      bookedSlots: [],
    });
    expect(result.find((item) => item.id === hallB)).toMatchObject({
      busy: true,
      bookedSlots: [
        {
          startAt: "2026-12-12T04:30:00.000Z",
          endAt: "2026-12-12T06:30:00.000Z",
        },
      ],
    });
  });

  it("keeps each hall's slots with that hall, earliest first as they arrive", async () => {
    const { service, deps } = setup({ venue: venue(), halls });
    deps.hallBooking.findHeldSlots.mockResolvedValue([
      {
        hallId: hallA,
        startAt: new Date("2026-12-12T04:00:00.000Z"),
        endAt: new Date("2026-12-12T05:00:00.000Z"),
      },
      {
        hallId: hallB,
        startAt: new Date("2026-12-12T04:30:00.000Z"),
        endAt: new Date("2026-12-12T06:30:00.000Z"),
      },
      {
        hallId: hallA,
        startAt: new Date("2026-12-12T07:00:00.000Z"),
        endAt: new Date("2026-12-12T08:00:00.000Z"),
      },
    ]);

    const result = await service.getHallAvailability(venueId, query, organizer);

    expect(result.find((item) => item.id === hallA)?.bookedSlots).toHaveLength(
      2,
    );
    expect(result.find((item) => item.id === hallB)?.bookedSlots).toHaveLength(
      1,
    );
  });

  it("shows only times: no session id, title or owner ever leaves", async () => {
    const { service, deps } = setup({ venue: venue(), halls });
    deps.hallBooking.findHeldSlots.mockResolvedValue([
      {
        hallId: hallA,
        startAt: new Date("2026-12-12T04:00:00.000Z"),
        endAt: new Date("2026-12-12T05:00:00.000Z"),
        // What a careless repository could leak; the service must not pass it on.
        title: "Secret launch",
        sessionId: "secret-session-id",
      },
    ]);

    const result = await service.getHallAvailability(venueId, query, organizer);

    expect(Object.keys(result[0].bookedSlots[0]).sort()).toEqual([
      "endAt",
      "startAt",
    ]);
    expect(JSON.stringify(result)).not.toContain("Secret launch");
    expect(JSON.stringify(result)).not.toContain("secret-session-id");
  });

  it("returns an empty list for a venue with no halls switched on", async () => {
    const { service, deps } = setup({
      venue: venue(),
      halls: [hall(hallC, "Hall C", 80, false)],
    });

    await expect(
      service.getHallAvailability(venueId, query, organizer),
    ).resolves.toEqual([]);
    expect(deps.hallBooking.findHeldSlots).toHaveBeenCalledWith(
      expect.objectContaining({ hallIds: [] }),
    );
  });
});

describe("hallAvailabilityService: who and which venue", () => {
  it("answers 404 for a venue that does not exist, before asking about bookings", async () => {
    const { service, deps } = setup(null);

    await expect(
      service.getHallAvailability(venueId, query, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(deps.hallBooking.findHeldSlots).not.toHaveBeenCalled();
  });

  it("answers 409 VENUE_INACTIVE for a deactivated venue, before asking about bookings", async () => {
    const { service, deps } = setup({
      venue: venue({ isActive: false }),
      halls,
    });

    const error = await service
      .getHallAvailability(venueId, query, organizer)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "VENUE_INACTIVE" });
    expect(deps.hallBooking.findHeldSlots).not.toHaveBeenCalled();
  });

  it("refuses an organizer an admin has not approved, before anything is read", async () => {
    const { service, deps } = setup({ venue: venue(), halls });
    deps.organizerVerification.assertVerifiedOrganizer.mockRejectedValue(
      new ForbiddenError(
        "Your organizer account is waiting for admin approval",
        "ORGANIZER_NOT_VERIFIED",
      ),
    );

    const error = await service
      .getHallAvailability(venueId, query, organizer)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      status: 403,
      code: "ORGANIZER_NOT_VERIFIED",
    });
    expect(deps.venueRepository.getVenueById).not.toHaveBeenCalled();
    expect(deps.hallBooking.findHeldSlots).not.toHaveBeenCalled();
  });

  it("asks the organizer service about the caller", async () => {
    const { service, deps } = setup({ venue: venue(), halls });

    await service.getHallAvailability(venueId, query, organizer);

    expect(
      deps.organizerVerification.assertVerifiedOrganizer,
    ).toHaveBeenCalledWith(organizer);
  });
});
