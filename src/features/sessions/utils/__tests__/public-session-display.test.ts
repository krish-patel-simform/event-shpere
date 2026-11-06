import type { PublicSessionDetailDto } from "../../schemas/session-public.schemas";
import { sessionPlace, sessionWhen } from "../public-session-display";

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
