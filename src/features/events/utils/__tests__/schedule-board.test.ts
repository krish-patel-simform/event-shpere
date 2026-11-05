import {
  SAMPLE_SESSIONS,
  SAMPLE_SPEAKERS,
  HALL_B,
  HALL_MAIN,
} from "../../sample/organizer-sample";
import {
  blockBox,
  boardHeight,
  boardHours,
  eventDays,
  formatMinute,
  HOUR_PX,
  isPlaced,
  sessionsInHall,
  slotLabel,
  speakerNames,
  unscheduledSessions,
} from "../schedule-board";

const ZONE = "Asia/Kolkata";

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
    ).toEqual([{ index: 0, key: "2026-12-03", label: "Thu 3 Dec" }]);
  });

  it("counts the day in the event's zone, not in UTC", () => {
    // 23:30 IST on 3 Dec is 18:00 UTC on 3 Dec; 00:30 IST on 4 Dec is 19:00 UTC on 3 Dec.
    expect(
      eventDays("2026-12-03T18:00:00.000Z", "2026-12-03T19:00:00.000Z", ZONE),
    ).toEqual([
      { index: 0, key: "2026-12-03", label: "Thu 3 Dec" },
      { index: 1, key: "2026-12-04", label: "Fri 4 Dec" },
    ]);
  });

  it("still gives one day when the dates are the wrong way round", () => {
    expect(
      eventDays("2026-12-05T03:30:00.000Z", "2026-12-03T12:30:00.000Z", ZONE),
    ).toHaveLength(1);
  });

  it("stops at a sane number of days", () => {
    expect(
      eventDays("2026-01-01T03:30:00.000Z", "2030-01-01T03:30:00.000Z", ZONE),
    ).toHaveLength(14);
  });
});

describe("the board's frame", () => {
  it("writes minutes as a clock time", () => {
    expect(formatMinute(570)).toBe("09:30");
    expect(formatMinute(17 * 60)).toBe("17:00");
  });

  it("has one label per hour from 09:00 to 17:00", () => {
    const hours = boardHours();
    expect(hours[0]).toBe("09:00");
    expect(hours.at(-1)).toBe("17:00");
    expect(hours).toHaveLength(9);
    expect(boardHeight()).toBe(9 * HOUR_PX);
  });

  it("places a block by its start and length", () => {
    expect(blockBox(9 * 60, 10 * 60)).toEqual({ top: 0, height: HOUR_PX });
    expect(blockBox(10 * 60 + 30, 12 * 60)).toEqual({
      top: 1.5 * HOUR_PX,
      height: 1.5 * HOUR_PX,
    });
  });

  it("clips a block that runs past the board's hours", () => {
    expect(blockBox(8 * 60, 9 * 60 + 30)).toEqual({
      top: 0,
      height: 0.5 * HOUR_PX,
    });
    expect(blockBox(17 * 60 + 30, 19 * 60)).toEqual({
      top: 8.5 * HOUR_PX,
      height: 0.5 * HOUR_PX,
    });
  });
});

describe("sessions on the board", () => {
  it("puts the sessions of one hall on one day in time order", () => {
    const titles = sessionsInHall(SAMPLE_SESSIONS, 0, HALL_B).map(
      (session) => session.title,
    );

    expect(titles).toEqual([
      "Scaling Next.js Applications: Lessons from Production",
      "Edge Rendering Explained",
      "Observability for Frontend Teams",
      "Micro-frontends in Practice",
    ]);
  });

  it("has nothing on a day or in a hall with no session", () => {
    expect(sessionsInHall(SAMPLE_SESSIONS, 1, HALL_MAIN)).toEqual([]);
  });

  it("lists the sessions still waiting for a hall and a time", () => {
    expect(unscheduledSessions(SAMPLE_SESSIONS).map((s) => s.title)).toEqual([
      "Platform Teams at Scale",
      "Design Tokens in Practice",
    ]);
  });

  it("does not ask for a time for a cancelled session", () => {
    const [placed] = SAMPLE_SESSIONS;
    const cancelledUnplaced = {
      ...placed,
      hallId: null,
      day: null,
      startMinute: null,
      endMinute: null,
      cancelled: true,
    };

    expect(isPlaced(cancelledUnplaced)).toBe(false);
    expect(unscheduledSessions([cancelledUnplaced])).toEqual([]);
  });

  it("names the speakers of a session, and is empty when it has none", () => {
    const panel = SAMPLE_SESSIONS.find(
      (s) => s.title === "Design Systems at Scale",
    );
    const tokens = SAMPLE_SESSIONS.find(
      (s) => s.title === "Design Tokens in Practice",
    );

    expect(speakerNames(panel!, SAMPLE_SPEAKERS)).toBe(
      "Meera Joshi, Vikram Mehta, Sneha Desai",
    );
    expect(speakerNames(tokens!, SAMPLE_SPEAKERS)).toBe("");
  });

  it("writes the slot of a placed session", () => {
    const [keynote] = SAMPLE_SESSIONS;
    if (!isPlaced(keynote)) throw new Error("the keynote is placed");

    expect(slotLabel(keynote)).toBe("09:30–10:30");
  });
});
