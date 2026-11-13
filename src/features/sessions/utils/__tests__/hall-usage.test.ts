import {
  cancelledKeynote,
  HALL_A_ID,
  HALL_B_ID,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import { hallRows, hallSessionsText } from "../hall-usage";

const hallA = {
  id: HALL_A_ID,
  name: "Hall A",
  capacity: 300,
  sortOrder: 1,
  isActive: true,
};
const hallB = {
  id: HALL_B_ID,
  name: "Hall B",
  capacity: 120,
  sortOrder: 2,
  isActive: true,
};
const mainHall = {
  id: "5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c99",
  name: "Main Hall",
  capacity: 600,
  sortOrder: 0,
  isActive: true,
};

describe("hallRows", () => {
  it("lists the halls in the venue's order: by sort order, then by name", () => {
    const rows = hallRows(
      [hallB, { ...hallA, sortOrder: 2, name: "A hall" }, mainHall],
      [],
    );

    expect(rows.map((row) => row.name)).toEqual([
      "Main Hall",
      "A hall",
      "Hall B",
    ]);
  });

  it("counts the sessions of the event in each hall, the cancelled ones apart", () => {
    const rows = hallRows(
      [hallA, hallB],
      [
        talk,
        { ...workshop, hallId: HALL_A_ID },
        { ...cancelledKeynote, hallId: HALL_A_ID },
      ],
    );

    expect(rows[0]).toMatchObject({
      name: "Hall A",
      sessionCount: 2,
      cancelledCount: 1,
    });
    expect(rows[1]).toMatchObject({
      name: "Hall B",
      sessionCount: 0,
      cancelledCount: 0,
    });
  });

  it("does not count an online session: it has no hall", () => {
    const rows = hallRows(
      [hallA],
      [{ ...talk, hallId: null, hallName: null, mode: "online" }],
    );

    expect(rows[0].sessionCount).toBe(0);
  });

  it("keeps the hall's own fields", () => {
    expect(hallRows([hallA], [])[0]).toMatchObject(hallA);
  });
});

describe("hallSessionsText", () => {
  const row = (sessionCount: number, cancelledCount: number) => ({
    ...hallA,
    sessionCount,
    cancelledCount,
  });

  it("writes the number of sessions in the hall", () => {
    expect(hallSessionsText(row(2, 0))).toBe("2 sessions");
    expect(hallSessionsText(row(1, 0))).toBe("1 session");
  });

  it("counts a cancelled session too, and says how many were cancelled", () => {
    expect(hallSessionsText(row(3, 1))).toBe("4 sessions · 1 cancelled");
  });

  it("says when the hall has no session", () => {
    expect(hallSessionsText(row(0, 0))).toBe("No sessions");
  });
});
