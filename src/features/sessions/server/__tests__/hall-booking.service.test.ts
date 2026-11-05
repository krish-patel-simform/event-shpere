import { ConflictError } from "../../../../core/http/errors";
import { createHallBookingService } from "../hall-booking.service";

// An empty factory: the DB client and env are never loaded.
jest.mock("../hall-booking.repository", () => ({}));

const hallId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const startAt = new Date("2026-12-12T04:30:00.000Z");
const endAt = new Date("2026-12-12T06:30:00.000Z");

function setup() {
  const repository = {
    findOverlappingSessions: jest.fn().mockResolvedValue([]),
    findHeldSlotsInHalls: jest.fn().mockResolvedValue([]),
  };
  return { repository, service: createHallBookingService({ repository }) };
}

describe("hallBookingService.assertHallFree", () => {
  it("lets the session through when nothing holds the hall at that time", async () => {
    const { service, repository } = setup();

    await expect(
      service.assertHallFree({ hallId, startAt, endAt }),
    ).resolves.toBeUndefined();
    expect(repository.findOverlappingSessions).toHaveBeenCalledWith({
      hallId,
      startAt,
      endAt,
    });
  });

  it("answers 409 HALL_BUSY when another session holds the hall", async () => {
    const { service, repository } = setup();
    repository.findOverlappingSessions.mockResolvedValue([
      {
        id: "a",
        startAt: new Date("2026-12-12T05:00:00.000Z"),
        endAt: new Date("2026-12-12T07:00:00.000Z"),
      },
    ]);

    const error = await service
      .assertHallFree({ hallId, startAt, endAt })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "HALL_BUSY" });
  });

  it("says WHEN the hall is taken, in ISO times, and nothing about the other session", async () => {
    const { service, repository } = setup();
    repository.findOverlappingSessions.mockResolvedValue([
      {
        id: "secret-session-id",
        startAt: new Date("2026-12-12T05:00:00.000Z"),
        endAt: new Date("2026-12-12T07:00:00.000Z"),
      },
    ]);

    const error = await service
      .assertHallFree({ hallId, startAt, endAt })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      details: {
        conflicts: [
          {
            startAt: "2026-12-12T05:00:00.000Z",
            endAt: "2026-12-12T07:00:00.000Z",
          },
        ],
      },
    });
    // The other session may belong to another organizer: no id leaves with the answer.
    expect(JSON.stringify(error)).not.toContain("secret-session-id");
    expect(String((error as Error).message)).not.toContain("secret-session-id");
  });

  it("lists every clash, not only the first", async () => {
    const { service, repository } = setup();
    repository.findOverlappingSessions.mockResolvedValue([
      {
        id: "a",
        startAt: new Date("2026-12-12T04:00:00.000Z"),
        endAt: new Date("2026-12-12T05:00:00.000Z"),
      },
      {
        id: "b",
        startAt: new Date("2026-12-12T06:00:00.000Z"),
        endAt: new Date("2026-12-12T07:00:00.000Z"),
      },
    ]);

    const error = await service
      .assertHallFree({ hallId, startAt, endAt })
      .catch((e: unknown) => e);

    expect((error as ConflictError).details?.conflicts).toHaveLength(2);
  });

  it("leaves the session being edited out of the check, so it does not clash with itself", async () => {
    const { service, repository } = setup();

    await service.assertHallFree({
      hallId,
      startAt,
      endAt,
      exceptSessionId: "editing-this-one",
    });

    expect(repository.findOverlappingSessions).toHaveBeenCalledWith({
      hallId,
      startAt,
      endAt,
      exceptSessionId: "editing-this-one",
    });
  });
});

describe("hallBookingService.findHeldSlots", () => {
  it("asks once for all the halls and returns the times they are taken", async () => {
    const { service, repository } = setup();
    const slot = {
      hallId: "h2",
      startAt: new Date("2026-12-12T05:00:00.000Z"),
      endAt: new Date("2026-12-12T06:00:00.000Z"),
    };
    repository.findHeldSlotsInHalls.mockResolvedValue([slot]);

    await expect(
      service.findHeldSlots({ hallIds: ["h1", "h2", "h3"], startAt, endAt }),
    ).resolves.toEqual([slot]);
    expect(repository.findHeldSlotsInHalls).toHaveBeenCalledTimes(1);
    expect(repository.findHeldSlotsInHalls).toHaveBeenCalledWith({
      hallIds: ["h1", "h2", "h3"],
      startAt,
      endAt,
    });
  });

  it("returns nothing for halls that are free for the whole range", async () => {
    const { service } = setup();

    await expect(
      service.findHeldSlots({ hallIds: ["h1"], startAt, endAt }),
    ).resolves.toEqual([]);
  });
});
