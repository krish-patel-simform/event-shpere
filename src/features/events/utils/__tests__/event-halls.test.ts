import { SAMPLE_HALLS, SAMPLE_SESSIONS } from "../../sample/organizer-sample";
import { hallRows, hallSessionsText } from "../event-halls";

const rows = hallRows(SAMPLE_HALLS, SAMPLE_SESSIONS);
const byName = (name: string) => {
  const row = rows.find((candidate) => candidate.name === name);
  if (!row) throw new Error(`no sample hall ${name}`);
  return row;
};

describe("hallRows", () => {
  it("keeps the halls in their order", () => {
    expect(rows.map((row) => row.name)).toEqual([
      "Main Hall",
      "Hall A",
      "Hall B",
      "Lab 3",
    ]);
  });

  it("counts the sessions placed in each hall, and the cancelled ones apart", () => {
    expect(byName("Main Hall")).toMatchObject({
      sessionCount: 2,
      cancelledCount: 0,
    });
    expect(byName("Hall B")).toMatchObject({
      sessionCount: 3,
      cancelledCount: 1,
    });
  });

  it("does not count a session that has no hall yet", () => {
    const total = rows.reduce(
      (sum, row) => sum + row.sessionCount + row.cancelledCount,
      0,
    );
    const placed = SAMPLE_SESSIONS.filter((s) => s.hallId !== null).length;

    expect(total).toBe(placed);
    expect(total).toBeLessThan(SAMPLE_SESSIONS.length);
  });
});

describe("hallSessionsText", () => {
  it("writes the number of sessions in the hall", () => {
    expect(hallSessionsText(byName("Main Hall"))).toBe("2 sessions");
    expect(hallSessionsText(byName("Lab 3"))).toBe("1 session");
  });

  it("adds how many of them are cancelled", () => {
    expect(hallSessionsText(byName("Hall B"))).toBe("4 sessions · 1 cancelled");
  });

  it("says when the hall has no session", () => {
    expect(
      hallSessionsText({
        ...byName("Lab 3"),
        sessionCount: 0,
        cancelledCount: 0,
      }),
    ).toBe("No sessions");
  });
});
