import {
  cancelledKeynote,
  HALL_A_ID,
  HALL_B_ID,
  SPEAKER_ANANYA_ID,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import type { BoardDay } from "../schedule-board";
import {
  sessionWhen,
  toBoardHalls,
  toMoveRequest,
  toScheduleSessions,
  withSessionMoved,
} from "../schedule-sessions";

const ZONE = "Asia/Kolkata";
const DAYS: BoardDay[] = [
  { index: 0, key: "2026-12-12", label: "Sat 12 Dec" },
  { index: 1, key: "2026-12-13", label: "Sun 13 Dec" },
];
const HALLS = toBoardHalls([
  {
    id: HALL_A_ID,
    name: "Hall A",
    capacity: 300,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: HALL_B_ID,
    name: "Hall B",
    capacity: 200,
    sortOrder: 2,
    isActive: true,
  },
]);
// Before the talk (10:00 IST on 12 Dec).
const BEFORE = new Date("2026-12-01T00:00:00.000Z");
const context = {
  days: DAYS,
  halls: HALLS,
  timezone: ZONE,
  now: BEFORE,
  locked: false,
};

describe("toBoardHalls", () => {
  it("keeps the venue's order and renames capacity and isActive", () => {
    const halls = toBoardHalls([
      { id: "b", name: "Hall B", capacity: 200, sortOrder: 2, isActive: false },
      { id: "a2", name: "Hall A2", capacity: 50, sortOrder: 1, isActive: true },
      { id: "a1", name: "Hall A1", capacity: 60, sortOrder: 1, isActive: true },
    ]);

    expect(halls).toEqual([
      { id: "a1", name: "Hall A1", seats: 60, active: true },
      { id: "a2", name: "Hall A2", seats: 50, active: true },
      { id: "b", name: "Hall B", seats: 200, active: false },
    ]);
  });
});

describe("toScheduleSessions", () => {
  it("draws a session with a hall and a time, in the event's zone", () => {
    const { placed, other } = toScheduleSessions([talk], context);

    expect(other).toEqual([]);
    expect(placed).toEqual([
      {
        id: talk.id,
        title: "Offline-first Event Apps",
        type: "talk",
        hallId: HALL_A_ID,
        day: 0,
        // 04:30 UTC is 10:00 IST, and the talk lasts an hour.
        startMinute: 10 * 60,
        endMinute: 11 * 60,
        speakers: [{ id: SPEAKER_ANANYA_ID, name: "Ananya Rao" }],
        cancelled: false,
        movable: true,
      },
    ]);
  });

  it("lists the speakers in the order they were given, whatever order the API sent", () => {
    // The workshop's speakers arrive with the second one first.
    const [placed] = toScheduleSessions([workshop], context).placed;

    expect(placed.speakers.map((speaker) => speaker.name)).toEqual([
      "Ananya Rao",
      "Rohan Mehta",
    ]);
  });

  it("draws a draft session too: it has a hall and a time", () => {
    expect(toScheduleSessions([workshop], context).placed).toHaveLength(1);
  });

  it("leaves out a session with no hall (an online one)", () => {
    const { placed, other } = toScheduleSessions([cancelledKeynote], context);

    expect(placed).toEqual([]);
    expect(other).toEqual([cancelledKeynote]);
  });

  it("lists the sessions left out with the running ones first, by time, then the cancelled ones", () => {
    const later = {
      ...cancelledKeynote,
      id: "later",
      status: "scheduled" as const,
      startAt: "2026-12-12T08:00:00.000Z",
      endAt: "2026-12-12T09:00:00.000Z",
    };
    const sooner = {
      ...later,
      id: "sooner",
      startAt: "2026-12-12T03:30:00.000Z",
      endAt: "2026-12-12T04:30:00.000Z",
    };
    const noTime = { ...later, id: "no-time", startAt: null, endAt: null };

    const { other } = toScheduleSessions(
      [cancelledKeynote, noTime, later, sooner],
      context,
    );

    expect(other.map((session) => session.id)).toEqual([
      "sooner",
      "later",
      "no-time",
      cancelledKeynote.id,
    ]);
  });

  it("leaves out a session whose hall is not one of the venue's", () => {
    const stray = { ...talk, hallId: "5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c99" };

    expect(toScheduleSessions([stray], context).other).toEqual([stray]);
  });

  it("leaves out a session on a day the board does not have", () => {
    const early = {
      ...talk,
      startAt: "2026-12-20T04:30:00.000Z",
      endAt: "2026-12-20T05:30:00.000Z",
    };

    expect(toScheduleSessions([early], context).other).toEqual([early]);
  });

  it("puts a session on the day it falls on in the event's zone, not in UTC", () => {
    // 20:30 UTC on 12 Dec is 02:00 IST on 13 Dec.
    const night = {
      ...talk,
      startAt: "2026-12-12T20:30:00.000Z",
      endAt: "2026-12-12T21:30:00.000Z",
    };

    expect(toScheduleSessions([night], context).placed[0]).toMatchObject({
      day: 1,
      startMinute: 2 * 60,
    });
  });

  it("draws a session that runs past midnight to the end of its day", () => {
    // 22:00 IST to 01:00 IST the next day.
    const late = {
      ...talk,
      startAt: "2026-12-12T16:30:00.000Z",
      endAt: "2026-12-12T19:30:00.000Z",
    };

    expect(toScheduleSessions([late], context).placed[0]).toMatchObject({
      day: 0,
      startMinute: 22 * 60,
      endMinute: 24 * 60,
    });
  });

  describe("which sessions can be moved", () => {
    const placedOf = (session: typeof talk, overrides = {}) =>
      toScheduleSessions([session], { ...context, ...overrides }).placed[0];

    it("can be moved: a scheduled session that has not ended", () => {
      expect(placedOf(talk).movable).toBe(true);
    });

    it("can not be moved once it has ended", () => {
      expect(
        placedOf(talk, { now: new Date("2026-12-12T05:30:01.000Z") }).movable,
      ).toBe(false);
    });

    it("can not be moved when it is cancelled", () => {
      const cancelled = { ...talk, status: "cancelled" as const };

      expect(placedOf(cancelled)).toMatchObject({
        cancelled: true,
        movable: false,
      });
    });

    it("can not be moved when the event is locked", () => {
      expect(placedOf(talk, { locked: true }).movable).toBe(false);
    });
  });
});

describe("sessionWhen", () => {
  it("names the day and the hours in the event's zone", () => {
    // 04:30 UTC is 10:00 IST.
    expect(sessionWhen(talk, ZONE)).toBe("Sat 12 Dec · 10:00–11:00");
  });

  it("names both days for a session that runs into the next day", () => {
    const overnight = {
      ...talk,
      startAt: "2026-12-12T16:30:00.000Z",
      endAt: "2026-12-12T19:30:00.000Z",
    };

    expect(sessionWhen(overnight, ZONE)).toBe(
      "Sat 12 Dec 22:00 – Sun 13 Dec 01:00",
    );
  });

  it("is null while the session has no time", () => {
    expect(
      sessionWhen({ ...talk, startAt: null, endAt: null }, ZONE),
    ).toBeNull();
  });
});

describe("toMoveRequest", () => {
  it("is the hall and the new start and end, as UTC instants", () => {
    const [moved] = toScheduleSessions([talk], context).placed;

    expect(
      toMoveRequest(
        {
          ...moved,
          hallId: HALL_B_ID,
          day: 1,
          startMinute: 14 * 60,
          endMinute: 15 * 60,
        },
        DAYS,
      ),
    ).toEqual({
      hallId: HALL_B_ID,
      // 14:00 IST on 13 Dec is 08:30 UTC.
      startAt: "2026-12-13T08:30:00.000Z",
      endAt: "2026-12-13T09:30:00.000Z",
    });
  });

  it("can end at midnight", () => {
    const [moved] = toScheduleSessions([talk], context).placed;

    expect(
      toMoveRequest(
        { ...moved, startMinute: 23 * 60, endMinute: 24 * 60 },
        DAYS,
      ).endAt,
    ).toBe("2026-12-12T18:30:00.000Z");
  });
});

describe("withSessionMoved", () => {
  it("moves one session and leaves the others as they were", () => {
    const moved = withSessionMoved(
      [talk, workshop],
      talk.id,
      {
        hallId: HALL_B_ID,
        startAt: "2026-12-13T08:30:00.000Z",
        endAt: "2026-12-13T09:30:00.000Z",
      },
      "Hall B",
    );

    expect(moved[0]).toMatchObject({
      hallId: HALL_B_ID,
      hallName: "Hall B",
      startAt: "2026-12-13T08:30:00.000Z",
      endAt: "2026-12-13T09:30:00.000Z",
      title: talk.title,
    });
    expect(moved[1]).toBe(workshop);
  });
});
