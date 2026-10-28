import type { ScheduleItem } from "../types/schedule.types";

// Data only the tests use (the screen's own sample data is in utils/schedule.sample.ts).

export const NOW = "2026-12-04T08:00:00.000Z";

function item(
  id: string,
  title: string,
  startsAt: string,
  endsAt: string,
  extra: Partial<ScheduleItem> = {},
): ScheduleItem {
  return {
    id,
    title,
    startsAt,
    endsAt,
    location: null,
    format: null,
    speakers: [],
    kind: "session",
    inSchedule: false,
    speaking: false,
    ...extra,
  };
}

/** Day 1: one item in the schedule. */
export const opening = item(
  "opening",
  "Opening keynote",
  "2026-12-03T09:00:00.000Z",
  "2026-12-03T10:00:00.000Z",
  {
    inSchedule: true,
    location: "Main hall",
    format: "Keynote",
    speakers: ["Priya Nair"],
  },
);

/** Day 2: A and B overlap, C starts when A ends, the break is not a session. */
export const talkA = item(
  "talk-a",
  "Talk A",
  "2026-12-04T10:00:00.000Z",
  "2026-12-04T10:45:00.000Z",
  { inSchedule: true, speaking: true, location: "Hall B", format: "Talk" },
);
export const talkB = item(
  "talk-b",
  "Talk B",
  "2026-12-04T10:30:00.000Z",
  "2026-12-04T11:30:00.000Z",
  { inSchedule: true, speakers: ["Meera Joshi", "Karan Shah"] },
);
export const talkC = item(
  "talk-c",
  "Talk C",
  "2026-12-04T10:45:00.000Z",
  "2026-12-04T11:30:00.000Z",
);
export const coffee = item(
  "coffee",
  "Coffee break",
  "2026-12-04T11:30:00.000Z",
  "2026-12-04T12:00:00.000Z",
  { kind: "break", location: "Foyer" },
);

/** Day 3: not in the schedule. */
export const closing = item(
  "closing",
  "Closing panel",
  "2026-12-05T15:00:00.000Z",
  "2026-12-05T16:00:00.000Z",
);

/** Deliberately not in time order. */
export const allItems: ScheduleItem[] = [
  closing,
  talkC,
  coffee,
  talkB,
  opening,
  talkA,
];
