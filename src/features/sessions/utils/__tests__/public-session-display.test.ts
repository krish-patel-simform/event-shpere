import type { PublicSessionDetailDto } from "../../schemas/session-public.schemas";
import {
  seatsTakenPercent,
  sessionPlace,
  sessionWhen,
  sessionWhere,
} from "../public-session-display";

const event: PublicSessionDetailDto["event"] = {
  slug: "summit",
  title: "Summit",
  status: "published",
  timezone: "Asia/Kolkata",
};

describe("sessionWhen", () => {
  it("shows the day and the times in the event's zone", () => {
    expect(
      sessionWhen({
        startAt: "2026-12-04T04:30:00.000Z",
        endAt: "2026-12-04T06:30:00.000Z",
        event,
      }),
    ).toEqual({ date: "Fri 4 Dec 2026", time: "10:00 – 12:00 IST" });
  });

  it("uses the event's zone, not the browser's, for the day", () => {
    // 20:00 UTC on the 4th is already the 5th in India.
    expect(
      sessionWhen({
        startAt: "2026-12-04T20:00:00.000Z",
        endAt: "2026-12-04T21:00:00.000Z",
        event,
      })?.date,
    ).toBe("Sat 5 Dec 2026");
  });

  it("is null until the session has both a start and an end", () => {
    expect(sessionWhen({ startAt: null, endAt: null, event })).toBeNull();
    expect(
      sessionWhen({ startAt: "2026-12-04T04:30:00.000Z", endAt: null, event }),
    ).toBeNull();
  });
});

describe("sessionPlace", () => {
  it("is the hall, or Online when there is none", () => {
    expect(sessionPlace({ hallName: "Lab 3" })).toBe("Lab 3");
    expect(sessionPlace({ hallName: null })).toBe("Online");
  });
});

describe("sessionWhere", () => {
  const venue = {
    name: "Tech Park Auditorium",
    addressLine: "12 MG Road",
    city: "Pune",
  };

  it("names the hall and the venue for an in-person session", () => {
    expect(sessionWhere({ mode: "in_person", hallName: "Hall A", venue })).toBe(
      "Hall A · Tech Park Auditorium, Pune",
    );
  });

  it("leaves out what is not known", () => {
    expect(sessionWhere({ mode: "in_person", hallName: null, venue })).toBe(
      "Tech Park Auditorium, Pune",
    );
    expect(
      sessionWhere({ mode: "in_person", hallName: "Hall A", venue: null }),
    ).toBe("Hall A");
    expect(
      sessionWhere({ mode: "in_person", hallName: null, venue: null }),
    ).toBe("Place to be announced");
  });

  it("is just Online for an online session, even at an event with a venue", () => {
    expect(sessionWhere({ mode: "online", hallName: null, venue })).toBe(
      "Online",
    );
  });

  it("adds that a hybrid session is also live online", () => {
    expect(sessionWhere({ mode: "hybrid", hallName: "Hall A", venue })).toBe(
      "Hall A · Tech Park Auditorium, Pune · Also live online",
    );
  });
});

describe("seatsTakenPercent", () => {
  it("is how much of the hall is booked, rounded", () => {
    expect(seatsTakenPercent(120, 32)).toBe(73);
    expect(seatsTakenPercent(100, 100)).toBe(0);
    expect(seatsTakenPercent(100, 0)).toBe(100);
  });

  it("stays between 0 and 100, and is 0 for a hall with no seats", () => {
    expect(seatsTakenPercent(100, 150)).toBe(0);
    expect(seatsTakenPercent(100, -5)).toBe(100);
    expect(seatsTakenPercent(0, 0)).toBe(0);
  });
});
