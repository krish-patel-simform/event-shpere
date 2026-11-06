import {
  checkEventHours,
  checkSessionShape,
  type SessionShape,
} from "../session-rules";

const start = new Date("2026-12-12T04:30:00.000Z");
const end = new Date("2026-12-12T05:30:00.000Z");
const hallId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const link = "https://meet.example.com/abc";

const inPerson: SessionShape = {
  mode: "in_person",
  hallId,
  onlineUrl: null,
  startAt: start,
  endAt: end,
};

const messages = (shape: SessionShape) =>
  checkSessionShape(shape).map((issue) => `${issue.path}: ${issue.message}`);

describe("checkSessionShape", () => {
  it("has nothing to say about a valid in-person, online or hybrid session", () => {
    expect(checkSessionShape(inPerson)).toEqual([]);
    expect(
      checkSessionShape({
        ...inPerson,
        mode: "online",
        hallId: null,
        onlineUrl: link,
      }),
    ).toEqual([]);
    expect(
      checkSessionShape({ ...inPerson, mode: "hybrid", onlineUrl: link }),
    ).toEqual([]);
  });

  describe("times", () => {
    it("wants a start and an end", () => {
      expect(
        messages({ ...inPerson, startAt: null, endAt: undefined }),
      ).toEqual(["startAt: Set the start time", "endAt: Set the end time"]);
    });

    it("wants the end after the start (equal is not enough)", () => {
      expect(messages({ ...inPerson, endAt: start })).toEqual([
        "endAt: End must be after the start",
      ]);
      expect(
        messages({ ...inPerson, endAt: new Date("2026-12-12T04:00:00.000Z") }),
      ).toEqual(["endAt: End must be after the start"]);
    });
  });

  describe("hall and link by mode", () => {
    it("wants a hall for in person", () => {
      expect(messages({ ...inPerson, hallId: null })).toEqual([
        "hallId: Choose a hall",
      ]);
      expect(messages({ ...inPerson, hallId: undefined })).toEqual([
        "hallId: Choose a hall",
      ]);
    });

    it("refuses a join link on an in-person session", () => {
      expect(messages({ ...inPerson, onlineUrl: link })).toEqual([
        "onlineUrl: An in-person session has no join link",
      ]);
    });

    it("wants a link and no hall for online", () => {
      const online: SessionShape = { ...inPerson, mode: "online" };

      expect(messages(online)).toEqual([
        "hallId: An online session has no hall",
        "onlineUrl: Add the join link",
      ]);
    });

    it("wants both a hall and a link for hybrid", () => {
      expect(messages({ ...inPerson, mode: "hybrid", hallId: null })).toEqual([
        "hallId: Choose a hall",
        "onlineUrl: Add the join link",
      ]);
    });
  });
});

describe("checkEventHours", () => {
  // 09:00 IST on 3 Dec to 17:00 IST on 5 Dec 2026.
  const multiDay = {
    startAt: new Date("2026-12-03T03:30:00.000Z"),
    endAt: new Date("2026-12-05T11:30:00.000Z"),
    timezone: "Asia/Kolkata",
  };
  /** A session on `day` from `from` to `to` o'clock IST. */
  const session = (
    day: number,
    from: [number, number],
    to: [number, number],
  ) => {
    const ist = (hour: number, minute: number) =>
      new Date(Date.UTC(2026, 11, day, hour, minute) - 330 * 60_000);
    return { startAt: ist(...from), endAt: ist(...to) };
  };
  const MESSAGE =
    "Sessions must take place between 09:00 and 17:00 on each day of the event";

  it("accepts a session inside the hours, on any day", () => {
    expect(checkEventHours(session(3, [10, 0], [11, 0]), multiDay)).toBeNull();
    expect(checkEventHours(session(4, [13, 30], [15, 0]), multiDay)).toBeNull();
    expect(checkEventHours(session(5, [9, 0], [10, 0]), multiDay)).toBeNull();
  });

  it("accepts a session from the opening time to the closing time, exactly", () => {
    expect(checkEventHours(session(4, [9, 0], [17, 0]), multiDay)).toBeNull();
  });

  it("refuses a session that ends after closing", () => {
    expect(checkEventHours(session(4, [16, 0], [18, 0]), multiDay)).toBe(
      MESSAGE,
    );
    expect(checkEventHours(session(4, [16, 0], [17, 1]), multiDay)).toBe(
      MESSAGE,
    );
  });

  it("refuses a session that starts before opening", () => {
    expect(checkEventHours(session(4, [8, 59], [10, 0]), multiDay)).toBe(
      MESSAGE,
    );
  });

  it("refuses a session that runs into the next day, even into hours that are open", () => {
    const overnight = {
      startAt: session(4, [16, 0], [17, 0]).startAt,
      endAt: session(5, [9, 30], [10, 0]).startAt,
    };

    expect(checkEventHours(overnight, multiDay)).toBe(MESSAGE);
  });

  it("reads the hours in the event's own zone, not the server's", () => {
    // The same instants, in New York: the event is 09:00-17:00 EST there, so a session 14:00-15:00
    // IST (03:30-04:30 EST that day) is far outside it.
    const newYork = {
      startAt: new Date("2026-12-03T14:00:00.000Z"), // 09:00 EST
      endAt: new Date("2026-12-05T22:00:00.000Z"), // 17:00 EST
      timezone: "America/New_York",
    };

    expect(
      checkEventHours(
        {
          startAt: new Date("2026-12-04T15:00:00.000Z"), // 10:00 EST
          endAt: new Date("2026-12-04T16:00:00.000Z"),
        },
        newYork,
      ),
    ).toBeNull();
    expect(
      checkEventHours(
        {
          startAt: new Date("2026-12-04T22:00:00.000Z"), // 17:00 EST
          endAt: new Date("2026-12-04T23:00:00.000Z"), // 18:00 EST
        },
        newYork,
      ),
    ).toBe(MESSAGE);
  });

  it("has no daily hours for an event that closes for the day at or before it opens", () => {
    // 18:00 IST on 3 Dec to 10:00 IST on 4 Dec.
    const night = {
      startAt: new Date("2026-12-03T12:30:00.000Z"),
      endAt: new Date("2026-12-04T04:30:00.000Z"),
      timezone: "Asia/Kolkata",
    };
    const crossingMidnight = {
      startAt: new Date("2026-12-03T17:30:00.000Z"), // 23:00 IST
      endAt: new Date("2026-12-03T19:30:00.000Z"), // 01:00 IST
    };

    expect(checkEventHours(crossingMidnight, night)).toBeNull();
    // Closing at the very time it opened (24 hours) is also a round-the-clock event.
    expect(
      checkEventHours(crossingMidnight, {
        ...night,
        endAt: new Date("2026-12-04T12:30:00.000Z"),
      }),
    ).toBeNull();
  });

  it("holds a one-day event to its own hours, the same as its range", () => {
    // 09:30-17:30 IST on 12 Dec.
    const oneDay = {
      startAt: new Date("2026-12-12T04:00:00.000Z"),
      endAt: new Date("2026-12-12T12:00:00.000Z"),
      timezone: "Asia/Kolkata",
    };

    expect(checkEventHours(session(12, [10, 0], [11, 0]), oneDay)).toBeNull();
    expect(checkEventHours(session(12, [16, 0], [18, 0]), oneDay)).toBe(
      "Sessions must take place between 09:30 and 17:30 on each day of the event",
    );
  });
});
