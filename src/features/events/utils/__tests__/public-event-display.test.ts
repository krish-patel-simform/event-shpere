import type { PublicSessionDto } from "../../schemas/event-public.schemas";
import {
  eventSpeakers,
  groupSessionsByDay,
  paragraphs,
  sessionMinutes,
  sessionStartTime,
  type TimedSession,
} from "../public-event-display";

const ZONE = "Asia/Kolkata";

const session = (
  overrides: Partial<PublicSessionDto> = {},
): PublicSessionDto => ({
  id: "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01",
  title: "Opening Keynote",
  type: "keynote",
  mode: "in_person",
  startAt: "2026-12-03T04:00:00.000Z",
  endAt: "2026-12-03T05:00:00.000Z",
  hallName: "Main Hall",
  price: 0,
  requiresRegistration: false,
  speakers: [],
  ...overrides,
});

describe("groupSessionsByDay", () => {
  it("groups by the day in the event's zone, days in order, earliest session first", () => {
    const days = groupSessionsByDay(
      [
        session({
          id: "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f03",
          title: "Day two",
          startAt: "2026-12-04T04:00:00.000Z",
          endAt: "2026-12-04T05:00:00.000Z",
        }),
        session({
          id: "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f02",
          title: "Later on day one",
          startAt: "2026-12-03T08:00:00.000Z",
          endAt: "2026-12-03T09:00:00.000Z",
        }),
        session(),
      ],
      ZONE,
    );

    expect(days.map((day) => [day.key, day.label])).toEqual([
      ["2026-12-03", "Thu 3"],
      ["2026-12-04", "Fri 4"],
    ]);
    expect(days[0].sessions.map((s) => s.title)).toEqual([
      "Opening Keynote",
      "Later on day one",
    ]);
  });

  it("puts a late-evening session on the day it starts in the event's zone, not in UTC", () => {
    // 23:30 IST on 3 Dec is 18:00 UTC on 3 Dec; 00:30 IST on 4 Dec is 19:00 UTC on 3 Dec.
    const days = groupSessionsByDay(
      [
        session({
          startAt: "2026-12-03T19:00:00.000Z",
          endAt: "2026-12-03T20:00:00.000Z",
        }),
      ],
      ZONE,
    );

    expect(days.map((day) => day.key)).toEqual(["2026-12-04"]);
  });

  it("leaves out a session that has no time yet", () => {
    expect(
      groupSessionsByDay([session({ startAt: null, endAt: null })], ZONE),
    ).toEqual([]);
  });
});

describe("session times", () => {
  it("shows the start in the event's zone, and the length in minutes", () => {
    const timed = session({
      startAt: "2026-12-03T04:00:00.000Z",
      endAt: "2026-12-03T04:45:00.000Z",
    }) as TimedSession;

    expect(sessionStartTime(timed, ZONE)).toBe("09:30");
    expect(sessionMinutes(timed)).toBe(45);
  });
});

describe("eventSpeakers", () => {
  const ananya = {
    slug: "ananya-rao",
    name: "Ananya Rao",
    role: "speaker" as const,
  };
  const meera = {
    slug: "meera-joshi",
    name: "Meera Joshi",
    role: "speaker" as const,
  };

  it("lists each speaker once, in first-seen order, with how many sessions they have", () => {
    expect(
      eventSpeakers([
        session({ speakers: [ananya, meera] }),
        session({ speakers: [ananya] }),
      ]),
    ).toEqual([
      { slug: "ananya-rao", name: "Ananya Rao", sessionCount: 2 },
      { slug: "meera-joshi", name: "Meera Joshi", sessionCount: 1 },
    ]);
  });

  it("is empty when no session has a speaker", () => {
    expect(eventSpeakers([session()])).toEqual([]);
  });
});

describe("paragraphs", () => {
  it("starts a new paragraph at a blank line and drops empty ones", () => {
    expect(paragraphs("First.\n\n  Second line\nstill second.\n\n\n")).toEqual([
      "First.",
      "Second line\nstill second.",
    ]);
  });

  it("is empty for blank text", () => {
    expect(paragraphs("  \n ")).toEqual([]);
  });
});
