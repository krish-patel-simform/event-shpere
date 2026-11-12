import { ConflictError, NotFoundError } from "../../../../core/http/errors";
import type { Hall } from "../../../../db/schemas";
import {
  createVenueBodySchema,
  createVenueResponseSchema,
  venueListQuerySchema,
  venueListResponseSchema,
} from "../../schemas/venue.schemas";
import type { VenueWithState } from "../venue.repository";
import { createVenueService, type VenueServiceDeps } from "../venue.service";

// Empty factory: the DB client and env are never loaded.
jest.mock("../venue.repository", () => ({}));

const createdAt = new Date("2026-10-30T10:00:00.000Z");
const adminId = "5d1c3a4b-7e8f-4a1b-9c2d-3e4f5a6b7c8d";
const admin = { id: adminId };

const gujaratId = "3b7c2d1e-6f5a-4e8d-9a0b-1c2d3e4f5a6b";

const body = createVenueBodySchema.parse({
  name: "GIFT City Convention Centre",
  addressLine: "Block 12, Zone 1, GIFT City",
  city: "Gandhinagar",
  state: "Gujarat",
  latitude: 23.16,
  longitude: 72.68,
  halls: [
    { name: "Hall A", capacity: 200 },
    { name: "Hall B", capacity: 80 },
  ],
});

const venueRow: VenueWithState = {
  id: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
  name: "GIFT City Convention Centre",
  addressLine: "Block 12, Zone 1, GIFT City",
  city: "Gandhinagar",
  stateId: gujaratId,
  stateName: "Gujarat",
  postalCode: null,
  country: "IN",
  timezone: "Asia/Kolkata",
  // Postgres numeric comes back as a string.
  latitude: "23.160000",
  longitude: "72.680000",
  isActive: true,
  createdBy: adminId,
  createdAt,
  updatedAt: createdAt,
};

const hallRow = (
  id: string,
  name: string,
  capacity: number,
  sortOrder: number,
): Hall => ({
  id,
  venueId: venueRow.id,
  name,
  capacity,
  sortOrder,
  isActive: true,
  createdAt,
  updatedAt: createdAt,
});

function makeService(
  createVenue: jest.Mock = jest.fn(),
  extra: {
    setVenueActive?: jest.Mock;
    setHallsActive?: jest.Mock;
    getVenueById?: jest.Mock;
    getHallById?: jest.Mock;
    addHall?: jest.Mock;
    deleteHall?: jest.Mock;
    listVenues?: jest.Mock;
  } = {},
) {
  const deps: VenueServiceDeps = {
    venueRepository: {
      createVenue,
      listVenues: extra.listVenues ?? jest.fn(),
      addHall: extra.addHall ?? jest.fn(),
      deleteHall: extra.deleteHall ?? jest.fn(),
      getVenueById: extra.getVenueById ?? jest.fn(),
      getHallById: extra.getHallById ?? jest.fn(),
      setVenueActive: extra.setVenueActive ?? jest.fn(),
      setHallsActive: extra.setHallsActive ?? jest.fn(),
    },
  };
  return createVenueService(deps);
}

describe("venueService.createVenue", () => {
  it("saves with the signed-in admin as creator and returns a valid DTO", async () => {
    const createVenue = jest.fn().mockResolvedValue({
      ok: true,
      venue: venueRow,
      // Returned out of order on purpose: the DTO must sort by sortOrder.
      halls: [
        hallRow("b0000000-0000-4000-8000-000000000002", "Hall B", 80, 1),
        hallRow("a0000000-0000-4000-8000-000000000001", "Hall A", 200, 0),
      ],
    });

    const dto = await makeService(createVenue).createVenue(body, admin);

    expect(createVenue).toHaveBeenCalledWith({ ...body, createdBy: adminId });
    expect(createVenueResponseSchema.parse(dto)).toEqual(dto);
    expect(dto.halls.map((hall) => hall.name)).toEqual(["Hall A", "Hall B"]);
    expect(dto.latitude).toBe(23.16);
    expect(dto.longitude).toBe(72.68);
    expect(dto.createdAt).toBe("2026-10-30T10:00:00.000Z");
  });

  it("never returns createdBy or other internal columns", async () => {
    const createVenue = jest
      .fn()
      .mockResolvedValue({ ok: true, venue: venueRow, halls: [] });

    const dto = await makeService(createVenue).createVenue(body, admin);

    expect(dto).not.toHaveProperty("createdBy");
    expect(dto).not.toHaveProperty("updatedAt");
    expect(dto).not.toHaveProperty("stateId");
  });

  it("returns the state's name, and null for an old venue with no state", async () => {
    const withState = jest
      .fn()
      .mockResolvedValue({ ok: true, venue: venueRow, halls: [] });
    const withoutState = jest.fn().mockResolvedValue({
      ok: true,
      venue: { ...venueRow, stateId: null, stateName: null },
      halls: [],
    });

    expect((await makeService(withState).createVenue(body, admin)).state).toBe(
      "Gujarat",
    );
    expect(
      (await makeService(withoutState).createVenue(body, admin)).state,
    ).toBeNull();
  });

  it("answers 404 when the chosen state does not exist", async () => {
    const createVenue = jest
      .fn()
      .mockResolvedValue({ ok: false, reason: "STATE_NOT_FOUND" });

    await expect(
      makeService(createVenue).createVenue(body, admin),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns null coordinates when the venue has no map pin", async () => {
    const createVenue = jest.fn().mockResolvedValue({
      ok: true,
      venue: { ...venueRow, latitude: null, longitude: null },
      halls: [],
    });

    const dto = await makeService(createVenue).createVenue(body, admin);

    expect(dto.latitude).toBeNull();
    expect(dto.longitude).toBeNull();
  });

  it("turns a duplicate name in the same city into a 409 VENUE_EXISTS", async () => {
    const createVenue = jest
      .fn()
      .mockResolvedValue({ ok: false, reason: "VENUE_EXISTS" });

    const error = await makeService(createVenue)
      .createVenue(body, admin)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "VENUE_EXISTS" });
  });

  it("lets unexpected repository failures through (they become a 500)", async () => {
    const createVenue = jest.fn().mockRejectedValue(new Error("db down"));

    await expect(
      makeService(createVenue).createVenue(body, admin),
    ).rejects.toThrow("db down");
  });
});

const hallA = "a0000000-0000-4000-8000-000000000001";
const hallB = "b0000000-0000-4000-8000-000000000002";

describe("venueService.setVenueStatus", () => {
  it("passes the hall choice to the repository and returns the venue with its halls", async () => {
    const setVenueActive = jest.fn().mockResolvedValue({
      ok: true,
      venue: venueRow,
      halls: [
        hallRow(hallA, "Hall A", 200, 0),
        hallRow(hallB, "Hall B", 80, 1),
      ],
    });

    const dto = await makeService(undefined, { setVenueActive }).setVenueStatus(
      venueRow.id,
      { isActive: true, activateHalls: "all" },
    );

    expect(setVenueActive).toHaveBeenCalledWith(venueRow.id, true, "all");
    expect(dto.halls).toHaveLength(2);
    expect(dto).not.toHaveProperty("createdBy");
  });

  it("is a 404 when the venue does not exist", async () => {
    const setVenueActive = jest
      .fn()
      .mockResolvedValue({ ok: false, reason: "VENUE_NOT_FOUND" });

    const error = await makeService(undefined, { setVenueActive })
      .setVenueStatus(venueRow.id, { isActive: false, activateHalls: "none" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("is a 409 VENUE_HAS_SESSIONS naming the halls that still have sessions", async () => {
    const busy = [
      { id: hallA, name: "Hall A" },
      { id: hallB, name: "Hall B" },
    ];
    const setVenueActive = jest
      .fn()
      .mockResolvedValue({ ok: false, reason: "HALLS_IN_USE", halls: busy });

    const error = await makeService(undefined, { setVenueActive })
      .setVenueStatus(venueRow.id, { isActive: false, activateHalls: "none" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      status: 409,
      code: "VENUE_HAS_SESSIONS",
      details: { halls: busy },
    });
    expect((error as Error).message).toContain(
      "Hall A, Hall B have sessions that are not over yet",
    );
  });

  it("says 'has' for a single busy hall", async () => {
    const setVenueActive = jest.fn().mockResolvedValue({
      ok: false,
      reason: "HALLS_IN_USE",
      halls: [{ id: hallA, name: "Hall A" }],
    });

    const error = await makeService(undefined, { setVenueActive })
      .setVenueStatus(venueRow.id, { isActive: false, activateHalls: "none" })
      .catch((e: unknown) => e);

    expect((error as Error).message).toContain(
      "Hall A has sessions that are not over yet",
    );
  });
});

describe("venueService.setHallsStatus", () => {
  it("turns the listed halls on and returns the updated hall list", async () => {
    const setHallsActive = jest.fn().mockResolvedValue({
      ok: true,
      venue: venueRow,
      halls: [hallRow(hallA, "Hall A", 200, 0)],
    });

    const dto = await makeService(undefined, { setHallsActive }).setHallsStatus(
      venueRow.id,
      { isActive: true, halls: [hallA] },
    );

    expect(setHallsActive).toHaveBeenCalledWith(venueRow.id, true, [hallA]);
    expect(dto.halls.map((hall) => hall.id)).toEqual([hallA]);
  });

  it("accepts 'all' for every hall of the venue", async () => {
    const setHallsActive = jest
      .fn()
      .mockResolvedValue({ ok: true, venue: venueRow, halls: [] });

    await makeService(undefined, { setHallsActive }).setHallsStatus(
      venueRow.id,
      { isActive: false, halls: "all" },
    );

    expect(setHallsActive).toHaveBeenCalledWith(venueRow.id, false, "all");
  });

  it.each([
    ["VENUE_NOT_FOUND", NotFoundError, 404],
    ["HALL_NOT_FOUND", NotFoundError, 404],
    ["VENUE_INACTIVE", ConflictError, 409],
  ] as const)(
    "maps %s to its HTTP error",
    async (reason, errorClass, status) => {
      const setHallsActive = jest.fn().mockResolvedValue({ ok: false, reason });

      const error = await makeService(undefined, { setHallsActive })
        .setHallsStatus(venueRow.id, { isActive: true, halls: "all" })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(errorClass);
      expect(error).toMatchObject({ status });
    },
  );

  it("is a 409 HALL_HAS_SESSIONS naming the halls that cannot be turned off", async () => {
    const busy = [{ id: hallA, name: "Hall A" }];
    const setHallsActive = jest
      .fn()
      .mockResolvedValue({ ok: false, reason: "HALLS_IN_USE", halls: busy });

    const error = await makeService(undefined, { setHallsActive })
      .setHallsStatus(venueRow.id, { isActive: false, halls: [hallA, hallB] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      status: 409,
      code: "HALL_HAS_SESSIONS",
      details: { halls: busy },
    });
    expect((error as Error).message).toContain("Nothing was deactivated");
    expect((error as Error).message).toContain(
      "Hall A has sessions that are not over yet",
    );
  });
});

describe("venueService.addHall", () => {
  const newHall = { name: "Hall C", capacity: 120 };

  it("passes the venue and hall to the repository and returns the updated hall list", async () => {
    const addHall = jest.fn().mockResolvedValue({
      ok: true,
      venue: venueRow,
      halls: [
        hallRow(hallA, "Hall A", 200, 0),
        hallRow("c0000000-0000-4000-8000-000000000003", "Hall C", 120, 1),
      ],
    });

    const dto = await makeService(undefined, { addHall }).addHall(
      venueRow.id,
      newHall,
    );

    expect(addHall).toHaveBeenCalledWith(venueRow.id, newHall);
    expect(dto.halls.map((hall) => hall.name)).toEqual(["Hall A", "Hall C"]);
    expect(dto).not.toHaveProperty("createdBy");
  });

  it.each([
    ["VENUE_NOT_FOUND", NotFoundError, 404, undefined],
    ["VENUE_INACTIVE", ConflictError, 409, "VENUE_INACTIVE"],
    ["HALL_EXISTS", ConflictError, 409, "HALL_EXISTS"],
  ] as const)(
    "maps %s to its HTTP error",
    async (reason, errorClass, status, code) => {
      const addHall = jest.fn().mockResolvedValue({ ok: false, reason });

      const error = await makeService(undefined, { addHall })
        .addHall(venueRow.id, newHall)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(errorClass);
      expect(error).toMatchObject(code ? { status, code } : { status });
    },
  );
});

describe("venueService.deleteHall", () => {
  it("returns the venue with its remaining halls", async () => {
    const deleteHall = jest.fn().mockResolvedValue({
      ok: true,
      venue: venueRow,
      halls: [hallRow(hallA, "Hall A", 200, 0)],
    });

    const dto = await makeService(undefined, { deleteHall }).deleteHall(
      venueRow.id,
      hallB,
    );

    expect(deleteHall).toHaveBeenCalledWith(venueRow.id, hallB);
    expect(dto.halls.map((hall) => hall.id)).toEqual([hallA]);
  });

  it.each([
    ["VENUE_NOT_FOUND", NotFoundError, 404, undefined],
    ["HALL_NOT_FOUND", NotFoundError, 404, undefined],
    ["LAST_HALL", ConflictError, 409, "LAST_HALL"],
    ["HALL_IN_USE", ConflictError, 409, "HALL_IN_USE"],
  ] as const)(
    "maps %s to its HTTP error",
    async (reason, errorClass, status, code) => {
      const deleteHall = jest.fn().mockResolvedValue({ ok: false, reason });

      const error = await makeService(undefined, { deleteHall })
        .deleteHall(venueRow.id, hallB)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(errorClass);
      expect(error).toMatchObject(code ? { status, code } : { status });
    },
  );
});

describe("venueService.listVenues", () => {
  const guest = { canManage: false };
  const manager = { canManage: true };
  const query = venueListQuerySchema.parse({});
  const listRow = {
    id: venueRow.id,
    name: venueRow.name,
    addressLine: venueRow.addressLine,
    city: venueRow.city,
    state: venueRow.stateName,
    country: venueRow.country,
    timezone: venueRow.timezone,
    isActive: true,
    hallCount: 4,
    hallsOn: 3,
    totalSeats: 520,
    // Not part of the list item: must never be sent.
    createdBy: adminId,
  };

  it("turns page and pageSize into limit and offset, and returns the rows with the paging meta", async () => {
    const listVenues = jest
      .fn()
      .mockResolvedValue({ rows: [listRow], total: 23 });

    const result = await makeService(undefined, { listVenues }).listVenues(
      { ...query, page: 3, pageSize: 10 },
      manager,
    );

    expect(listVenues).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20, sort: "name" }),
    );
    expect(result.meta).toEqual({ page: 3, pageSize: 10, total: 23 });
    expect(venueListResponseSchema.parse(result.items)).toEqual(result.items);
    expect(result.items[0]).toMatchObject({
      hallCount: 4,
      hallsOn: 3,
      totalSeats: 520,
    });
    expect(result.items[0]).not.toHaveProperty("createdBy");
  });

  it("passes the search, the status and the sort on to the repository for an admin", async () => {
    const listVenues = jest.fn().mockResolvedValue({ rows: [], total: 0 });

    await makeService(undefined, { listVenues }).listVenues(
      { ...query, search: "pune", status: "inactive", sort: "halls" },
      manager,
    );

    expect(listVenues).toHaveBeenCalledWith({
      search: "pune",
      status: "inactive",
      sort: "halls",
      onlyActiveHalls: false,
      limit: 10,
      offset: 0,
    });
  });

  it("passes the state name on to the repository, for guests too", async () => {
    const listVenues = jest.fn().mockResolvedValue({ rows: [], total: 0 });
    const service = makeService(undefined, { listVenues });

    await service.listVenues({ ...query, state: "Gujarat" }, guest);
    await service.listVenues({ ...query, state: "Gujarat" }, manager);

    expect(listVenues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ state: "Gujarat", status: "active" }),
    );
    expect(listVenues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ state: "Gujarat" }),
    );
  });

  it("treats a blank state as no state filter", async () => {
    const listVenues = jest.fn().mockResolvedValue({ rows: [], total: 0 });

    await makeService(undefined, { listVenues }).listVenues(
      { ...query, state: "" },
      manager,
    );

    expect(listVenues).toHaveBeenCalledWith(
      expect.objectContaining({ state: undefined }),
    );
  });

  it("treats a blank search as no search", async () => {
    const listVenues = jest.fn().mockResolvedValue({ rows: [], total: 0 });

    await makeService(undefined, { listVenues }).listVenues(
      { ...query, search: "" },
      manager,
    );

    expect(listVenues).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    );
  });

  it("gives a guest only active venues, even when they ask for inactive ones or for all", async () => {
    const listVenues = jest.fn().mockResolvedValue({ rows: [], total: 0 });
    const service = makeService(undefined, { listVenues });

    await service.listVenues({ ...query, status: "inactive" }, guest);
    await service.listVenues(query, guest);

    expect(listVenues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "active", onlyActiveHalls: true }),
    );
    expect(listVenues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: "active", onlyActiveHalls: true }),
    );
  });

  it("lets an admin list every venue when no status is asked for", async () => {
    const listVenues = jest.fn().mockResolvedValue({ rows: [], total: 0 });

    await makeService(undefined, { listVenues }).listVenues(query, manager);

    expect(listVenues).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined }),
    );
  });
});

describe("venueService.getVenueDetail", () => {
  const halls = [
    hallRow(hallA, "Hall A", 200, 0),
    { ...hallRow(hallB, "Hall B", 80, 1), isActive: false },
  ];
  const guest = { canManage: false };
  const admin = { canManage: true };

  it("shows a guest an active venue with only its active halls", async () => {
    const getVenueById = jest
      .fn()
      .mockResolvedValue({ venue: venueRow, halls });

    const dto = await makeService(undefined, { getVenueById }).getVenueDetail(
      venueRow.id,
      guest,
    );

    expect(dto.halls.map((hall) => hall.id)).toEqual([hallA]);
  });

  it("shows an admin every hall, including inactive ones", async () => {
    const getVenueById = jest
      .fn()
      .mockResolvedValue({ venue: venueRow, halls });

    const dto = await makeService(undefined, { getVenueById }).getVenueDetail(
      venueRow.id,
      admin,
    );

    expect(dto.halls.map((hall) => hall.id)).toEqual([hallA, hallB]);
  });

  it("hides an inactive venue from a guest with a 404, but not from an admin", async () => {
    const inactive = { ...venueRow, isActive: false };
    const getVenueById = jest
      .fn()
      .mockResolvedValue({ venue: inactive, halls: [] });
    const service = makeService(undefined, { getVenueById });

    const error = await service
      .getVenueDetail(venueRow.id, guest)
      .catch((e: unknown) => e);
    const dto = await service.getVenueDetail(venueRow.id, admin);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(dto.isActive).toBe(false);
  });

  it("is a 404 when the venue does not exist", async () => {
    const getVenueById = jest.fn().mockResolvedValue(null);

    const error = await makeService(undefined, { getVenueById })
      .getVenueDetail(venueRow.id, admin)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});

describe("venueService.getHallDetail", () => {
  const activeHall = hallRow(hallA, "Hall A", 200, 0);
  const guest = { canManage: false };
  const admin = { canManage: true };

  it("returns the hall with a short venue summary", async () => {
    const getHallById = jest
      .fn()
      .mockResolvedValue({ venue: venueRow, hall: activeHall });

    const dto = await makeService(undefined, { getHallById }).getHallDetail(
      venueRow.id,
      hallA,
      guest,
    );

    expect(getHallById).toHaveBeenCalledWith(venueRow.id, hallA);
    expect(dto).toMatchObject({
      id: hallA,
      name: "Hall A",
      venue: { id: venueRow.id, name: venueRow.name, city: "Gandhinagar" },
    });
    expect(dto.venue).not.toHaveProperty("createdBy");
  });

  it("hides an inactive hall, or a hall of an inactive venue, from a guest", async () => {
    for (const row of [
      { venue: venueRow, hall: { ...activeHall, isActive: false } },
      { venue: { ...venueRow, isActive: false }, hall: activeHall },
    ]) {
      const getHallById = jest.fn().mockResolvedValue(row);
      const error = await makeService(undefined, { getHallById })
        .getHallDetail(venueRow.id, hallA, guest)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });

  it("shows an inactive hall to an admin", async () => {
    const getHallById = jest.fn().mockResolvedValue({
      venue: venueRow,
      hall: { ...activeHall, isActive: false },
    });

    const dto = await makeService(undefined, { getHallById }).getHallDetail(
      venueRow.id,
      hallA,
      admin,
    );

    expect(dto.isActive).toBe(false);
  });

  it("is a 404 when the hall is not in that venue", async () => {
    const getHallById = jest.fn().mockResolvedValue(null);

    const error = await makeService(undefined, { getHallById })
      .getHallDetail(venueRow.id, hallA, admin)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});
