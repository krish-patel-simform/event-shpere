import {
  allItems,
  closing,
  coffee,
  NOW,
  opening,
  talkA,
  talkB,
  talkC,
} from "../../__fixtures__/schedule";
import {
  defaultDayKey,
  findConflicts,
  groupByDay,
  itemsForView,
  overlaps,
  sortItems,
  toggleInSchedule,
} from "../schedule-items";

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

describe("sortItems", () => {
  it("orders by start time and does not mutate the input", () => {
    const input = [...allItems];
    expect(ids(sortItems(input))).toEqual([
      "opening",
      "talk-a",
      "talk-b",
      "talk-c",
      "coffee",
      "closing",
    ]);
    expect(ids(input)).toEqual(ids(allItems));
  });

  it("puts the shorter item first when two start together", () => {
    const long = { ...talkA, id: "long", endsAt: "2026-12-04T12:00:00.000Z" };
    expect(ids(sortItems([long, talkA]))).toEqual(["talk-a", "long"]);
  });
});

describe("groupByDay", () => {
  it("makes one day per date, in date order, with the items in time order", () => {
    const days = groupByDay(allItems);
    expect(days.map((day) => day.key)).toEqual([
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
    ]);
    expect(ids(days[1].items)).toEqual([
      "talk-a",
      "talk-b",
      "talk-c",
      "coffee",
    ]);
  });

  it("writes the day label and heading", () => {
    const [first] = groupByDay([opening]);
    expect(first.label).toBe("Thu, 3 Dec");
    expect(first.heading).toBe("Thursday, 3 December 2026");
  });

  it("groups by the UTC date", () => {
    const late = {
      ...talkA,
      id: "late",
      startsAt: "2026-12-04T23:30:00.000Z",
      endsAt: "2026-12-05T00:30:00.000Z",
    };
    expect(groupByDay([late])[0].key).toBe("2026-12-04");
  });

  it("gives no days for no items", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("itemsForView", () => {
  it("shows only what was added in My items", () => {
    expect(ids(itemsForView(allItems, "mine")).sort()).toEqual([
      "opening",
      "talk-a",
      "talk-b",
    ]);
  });

  it("shows everything, breaks included, in the full programme", () => {
    expect(itemsForView(allItems, "full")).toHaveLength(allItems.length);
  });
});

describe("toggleInSchedule", () => {
  it("adds a session and removes it again", () => {
    const added = toggleInSchedule(allItems, closing.id);
    expect(added.find((i) => i.id === closing.id)?.inSchedule).toBe(true);
    const removed = toggleInSchedule(added, closing.id);
    expect(removed.find((i) => i.id === closing.id)?.inSchedule).toBe(false);
  });

  it("does not add a break and does not mutate", () => {
    const result = toggleInSchedule(allItems, coffee.id);
    expect(result.find((i) => i.id === coffee.id)?.inSchedule).toBe(false);
    expect(closing.inSchedule).toBe(false);
  });
});

describe("overlaps", () => {
  it("is true when the times share a minute", () => {
    expect(overlaps(talkA, talkB)).toBe(true);
    expect(overlaps(talkB, talkA)).toBe(true);
  });

  it("is false when one starts as the other ends", () => {
    expect(overlaps(talkA, talkC)).toBe(false);
    expect(overlaps(talkC, coffee)).toBe(false);
  });
});

describe("findConflicts", () => {
  it("marks both sessions of an overlap with the other one", () => {
    const conflicts = findConflicts(allItems);
    expect(conflicts.size).toBe(2);
    expect(ids(conflicts.get("talk-a") ?? [])).toEqual(["talk-b"]);
    expect(ids(conflicts.get("talk-b") ?? [])).toEqual(["talk-a"]);
  });

  it("ignores sessions that are not in the schedule", () => {
    // Talk C is not added, and it would overlap Talk B.
    const cOverlapsB = { ...talkC, startsAt: "2026-12-04T11:00:00.000Z" };
    expect(overlaps(cOverlapsB, talkB)).toBe(true);
    expect(findConflicts([cOverlapsB, talkB]).size).toBe(0);
  });

  it("ignores breaks, even when added", () => {
    const addedBreak = {
      ...coffee,
      inSchedule: true,
      startsAt: talkB.startsAt,
    };
    expect(findConflicts([addedBreak, talkB]).size).toBe(0);
  });

  it("is empty when nothing overlaps", () => {
    expect(findConflicts([opening, talkA]).size).toBe(0);
  });
});

describe("defaultDayKey", () => {
  const days = groupByDay(allItems);

  it("opens today's day when the programme has it", () => {
    expect(defaultDayKey(days, NOW)).toBe("2026-12-04");
  });

  it("opens the next day with something on before the event", () => {
    expect(defaultDayKey(days, "2026-11-01T00:00:00.000Z")).toBe("2026-12-03");
    expect(defaultDayKey(days, "2026-12-04T23:59:00.000Z")).toBe("2026-12-04");
  });

  it("opens the last day after the event", () => {
    expect(defaultDayKey(days, "2027-01-01T00:00:00.000Z")).toBe("2026-12-05");
  });

  it("is undefined without days", () => {
    expect(defaultDayKey([], NOW)).toBeUndefined();
  });
});
