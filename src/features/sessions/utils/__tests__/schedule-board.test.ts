import {
  blockBox,
  boardHeight,
  boardHours,
  dayToOpen,
  DEFAULT_FRAME,
  describeClash,
  dropTarget,
  eventDays,
  findMoveClash,
  formatMinute,
  frameFor,
  HOUR_PX,
  minuteFromOffset,
  moveSession,
  sessionsInHall,
  slotLabel,
  speakerNames,
  type BoardHall,
  type BoardSession,
} from "../schedule-board";

const ZONE = "Asia/Kolkata";
const MAIN = "hall-main";
const A = "hall-a";
const B = "hall-b";
const LAB = "hall-lab";
const MEERA = { id: "meera", name: "Meera Joshi" };
const ARJUN = { id: "arjun", name: "Arjun Nair" };

const HALLS: BoardHall[] = [
  { id: MAIN, name: "Main Hall", seats: 600, active: true },
  { id: A, name: "Hall A", seats: 300, active: true },
  { id: B, name: "Hall B", seats: 300, active: true },
  { id: LAB, name: "Lab 3", seats: 60, active: true },
];

/** A session at `start`–`end` ("09:30" as hours and minutes), on day 0 unless said otherwise. */
function session(
  id: string,
  hallId: string,
  start: [number, number],
  end: [number, number],
  rest: Partial<BoardSession> = {},
): BoardSession {
  return {
    id,
    title: `Session ${id}`,
    type: "talk",
    hallId,
    day: 0,
    startMinute: start[0] * 60 + start[1],
    endMinute: end[0] * 60 + end[1],
    speakers: [],
    cancelled: false,
    movable: true,
    ...rest,
  };
}

describe("eventDays", () => {
  it("lists every calendar day of the event in its own zone", () => {
    // 09:00 IST on 3 Dec to 18:00 IST on 5 Dec.
    expect(
      eventDays("2026-12-03T03:30:00.000Z", "2026-12-05T12:30:00.000Z", ZONE),
    ).toEqual([
      { index: 0, key: "2026-12-03", label: "Thu 3 Dec" },
      { index: 1, key: "2026-12-04", label: "Fri 4 Dec" },
      { index: 2, key: "2026-12-05", label: "Sat 5 Dec" },
    ]);
  });

  it("has one day for an event that starts and ends on the same day", () => {
    expect(
      eventDays("2026-12-03T03:30:00.000Z", "2026-12-03T12:30:00.000Z", ZONE),
    ).toHaveLength(1);
  });

  it("counts the day in the event's zone, not in UTC", () => {
    // 23:30 IST on 3 Dec to 00:30 IST on 4 Dec.
    expect(
      eventDays("2026-12-03T18:00:00.000Z", "2026-12-03T19:00:00.000Z", ZONE),
    ).toHaveLength(2);
  });

  it("draws all the days of a 20-day event, and stops there", () => {
    const days = eventDays(
      "2026-12-01T03:30:00.000Z",
      "2026-12-20T12:30:00.000Z",
      ZONE,
    );
    expect(days).toHaveLength(20);
    expect(days[19].label).toBe("Sun 20 Dec");

    expect(
      eventDays("2026-01-01T03:30:00.000Z", "2030-01-01T03:30:00.000Z", ZONE),
    ).toHaveLength(20);
  });
});

describe("the board's frame", () => {
  it("is nine to six when every session fits in it", () => {
    expect(frameFor([session("1", MAIN, [10, 0], [11, 0])])).toEqual(
      DEFAULT_FRAME,
    );
    expect(frameFor([])).toEqual(DEFAULT_FRAME);
  });

  it("grows by whole hours for a session before nine or after six", () => {
    expect(
      frameFor([
        session("1", MAIN, [8, 30], [9, 30]),
        session("2", MAIN, [17, 0], [19, 15]),
      ]),
    ).toEqual({ firstHour: 8, lastHour: 20 });
  });

  it("never goes past midnight", () => {
    expect(frameFor([session("1", MAIN, [22, 0], [24, 0])]).lastHour).toBe(24);
  });

  it("writes minutes as a clock time", () => {
    expect(formatMinute(570)).toBe("09:30");
    expect(formatMinute(17 * 60)).toBe("17:00");
  });

  it("has one label per hour of the frame", () => {
    expect(boardHours(DEFAULT_FRAME)).toHaveLength(9);
    expect(boardHours(DEFAULT_FRAME)[0]).toBe("09:00");
    expect(boardHours({ firstHour: 8, lastHour: 20 })).toHaveLength(12);
    expect(boardHeight(DEFAULT_FRAME)).toBe(9 * HOUR_PX);
  });

  it("puts a block where its time falls, clipped to the frame", () => {
    expect(blockBox(9 * 60 + 30, 10 * 60 + 30, DEFAULT_FRAME)).toEqual({
      top: HOUR_PX / 2,
      height: HOUR_PX,
    });
    expect(blockBox(8 * 60, 10 * 60, DEFAULT_FRAME)).toEqual({
      top: 0,
      height: HOUR_PX,
    });
    expect(blockBox(7 * 60, 8 * 60, DEFAULT_FRAME).height).toBe(0);
  });
});

describe("reading sessions", () => {
  it("lists the sessions of one hall on one day, earliest first", () => {
    const sessions = [
      session("late", A, [13, 0], [14, 0]),
      session("early", A, [10, 0], [11, 0]),
      session("other-hall", B, [10, 0], [11, 0]),
      session("other-day", A, [10, 0], [11, 0], { day: 1 }),
    ];

    expect(sessionsInHall(sessions, 0, A).map((s) => s.id)).toEqual([
      "early",
      "late",
    ]);
  });

  it("names the speakers, and is empty when there are none", () => {
    expect(
      speakerNames(
        session("1", A, [9, 0], [10, 0], { speakers: [MEERA, ARJUN] }),
      ),
    ).toBe("Meera Joshi, Arjun Nair");
    expect(speakerNames(session("1", A, [9, 0], [10, 0]))).toBe("");
  });

  it("writes the slot of a session", () => {
    expect(slotLabel(session("1", A, [9, 30], [10, 30]))).toBe("09:30–10:30");
  });
});

describe("minuteFromOffset", () => {
  it("is the first hour at the top of the column and one hour later one hour down", () => {
    expect(minuteFromOffset(0, DEFAULT_FRAME)).toBe(9 * 60);
    expect(minuteFromOffset(HOUR_PX, DEFAULT_FRAME)).toBe(10 * 60);
    expect(minuteFromOffset(0, { firstHour: 8, lastHour: 20 })).toBe(8 * 60);
  });

  it("snaps to 15 minutes", () => {
    expect(minuteFromOffset(20, DEFAULT_FRAME)).toBe(9 * 60 + 15);
    expect(minuteFromOffset(31, DEFAULT_FRAME)).toBe(9 * 60 + 30);
  });
});

describe("moveSession", () => {
  const talk = session("talk", B, [11, 30], [12, 30]);

  it("changes hall, day and start, and keeps the length", () => {
    expect(
      moveSession(
        talk,
        { hallId: A, day: 1, startMinute: 14 * 60 },
        DEFAULT_FRAME,
      ),
    ).toMatchObject({
      hallId: A,
      day: 1,
      startMinute: 14 * 60,
      endMinute: 15 * 60,
    });
  });

  it("pulls a block that would start before the frame down to its first hour", () => {
    expect(
      moveSession(
        talk,
        { hallId: B, day: 0, startMinute: 8 * 60 },
        DEFAULT_FRAME,
      ),
    ).toMatchObject({ startMinute: 9 * 60, endMinute: 10 * 60 });
  });

  it("pulls a block that would end after the frame up so it ends at the last hour", () => {
    const workshop = session("workshop", LAB, [14, 0], [16, 0]);

    expect(
      moveSession(
        workshop,
        { hallId: LAB, day: 0, startMinute: 17 * 60 },
        DEFAULT_FRAME,
      ),
    ).toMatchObject({ startMinute: 16 * 60, endMinute: 18 * 60 });
  });

  it("does not change the session it was given", () => {
    moveSession(
      talk,
      { hallId: A, day: 1, startMinute: 14 * 60 },
      DEFAULT_FRAME,
    );

    expect(talk).toMatchObject({ hallId: B, day: 0 });
  });
});

describe("findMoveClash", () => {
  const keynote = session("keynote", MAIN, [9, 30], [10, 30], {
    speakers: [MEERA],
  });
  const scaling = session("scaling", B, [10, 0], [11, 30]);
  const hallATalks = [
    session("a1", A, [11, 30], [12, 30]),
    session("a2", A, [13, 30], [14, 30]),
  ];
  const all = [keynote, scaling, ...hallATalks];
  const edge = session("edge", B, [11, 30], [12, 30]);
  const moveTo = (
    s: BoardSession,
    hallId: string,
    day: number,
    h: number,
    m = 0,
  ) => moveSession(s, { hallId, day, startMinute: h * 60 + m }, DEFAULT_FRAME);

  it("is null when the slot is free, even back to back with other sessions", () => {
    // Hall A has a session ending at 12:30 and the next one starting at 13:30.
    expect(findMoveClash(all, moveTo(edge, A, 0, 12, 30))).toBeNull();
  });

  it("ignores the session's own old slot", () => {
    expect(
      findMoveClash([...all, edge], moveTo(edge, B, 0, 11, 45)),
    ).toBeNull();
  });

  it("reports a busy hall", () => {
    expect(findMoveClash([...all, edge], moveTo(edge, B, 0, 11))).toMatchObject(
      {
        kind: "hall",
        with: { id: "scaling" },
      },
    );
  });

  it("reports a speaker who is in another hall at that time", () => {
    const meeraTalk = session("meera-talk", A, [11, 30], [12, 30], {
      speakers: [MEERA],
    });

    expect(findMoveClash(all, moveTo(meeraTalk, LAB, 0, 9, 30))).toMatchObject({
      kind: "speaker",
      with: { id: "keynote" },
    });
  });

  it("does not clash with a session on another day", () => {
    expect(findMoveClash(all, moveTo(edge, B, 1, 10))).toBeNull();
  });

  it("does not clash with a cancelled session", () => {
    const cancelled = session("c", B, [16, 30], [17, 30], { cancelled: true });

    expect(findMoveClash([cancelled], moveTo(edge, B, 0, 16, 30))).toBeNull();
  });

  it("reports the hall before the speaker when both clash", () => {
    const meeraTalk = session("meera-talk", A, [11, 30], [12, 30], {
      speakers: [MEERA],
    });

    expect(findMoveClash(all, moveTo(meeraTalk, B, 0, 10))?.kind).toBe("hall");
  });
});

describe("dropTarget", () => {
  const talk = session("talk", B, [11, 30], [12, 30]);

  it("over a hall: that hall, the shown day, and the time the block's top edge is at", () => {
    expect(
      dropTarget(
        talk,
        { kind: "hall", hallId: A, top: 200 },
        1,
        200 + HOUR_PX,
        DEFAULT_FRAME,
      ),
    ).toEqual({ hallId: A, day: 1, startMinute: 10 * 60 });
  });

  it("over a day's tab: keeps the hall and the time, changes the day", () => {
    expect(
      dropTarget(talk, { kind: "day", day: 2 }, 0, 999, DEFAULT_FRAME),
    ).toEqual({
      hallId: B,
      day: 2,
      startMinute: 11 * 60 + 30,
    });
  });
});

describe("describeClash", () => {
  it("names the session that holds the hall, and when", () => {
    const scaling = session("scaling", B, [10, 0], [11, 30], {
      title: "Scaling Next.js",
    });
    const moved = session("edge", B, [11, 0], [12, 0]);

    expect(describeClash({ kind: "hall", with: scaling }, moved, HALLS)).toBe(
      'Hall B is busy: "Scaling Next.js" at 10:00–11:30.',
    );
  });

  it("names the speaker who is in another hall", () => {
    const keynote = session("keynote", MAIN, [9, 30], [10, 30], {
      title: "Opening Keynote",
      speakers: [MEERA],
    });
    const moved = session("moved", LAB, [9, 30], [10, 30], {
      speakers: [ARJUN, MEERA],
    });

    expect(
      describeClash({ kind: "speaker", with: keynote }, moved, HALLS),
    ).toBe('Meera Joshi is already in "Opening Keynote" at 09:30–10:30.');
  });
});

describe("dayToOpen", () => {
  it("opens the day whose tab the block is held over", () => {
    expect(dayToOpen({ kind: "day", day: 4 }, 1, 6)).toBe(4);
  });

  it("opens the next or the previous day for a step", () => {
    expect(dayToOpen({ kind: "step", by: 1 }, 2, 6)).toBe(3);
    expect(dayToOpen({ kind: "step", by: -1 }, 2, 6)).toBe(1);
  });

  it("opens nothing when there is no hover or the day is already shown", () => {
    expect(dayToOpen(null, 2, 6)).toBeNull();
    expect(dayToOpen({ kind: "day", day: 2 }, 2, 6)).toBeNull();
  });

  it("does not step past the first or the last day", () => {
    expect(dayToOpen({ kind: "step", by: -1 }, 0, 6)).toBeNull();
    expect(dayToOpen({ kind: "step", by: 1 }, 5, 6)).toBeNull();
  });
});
