import {
  cancelledKeynote,
  HALL_A_ID,
  HALL_B_ID,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import {
  ALL_HALLS,
  filterSessionsByHall,
  hallFilterOptions,
  NO_HALL,
} from "../session-hall-filter";

const hallA = { id: HALL_A_ID, name: "Hall A", sortOrder: 1 };
const hallB = { id: HALL_B_ID, name: "Hall B", sortOrder: 2 };
const lab = {
  id: "5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c99",
  name: "Lab 3",
  sortOrder: 0,
};

// talk: Hall A · workshop: Hall B · cancelledKeynote: no hall (online)
const sessions = [cancelledKeynote, talk, workshop];

describe("hallFilterOptions", () => {
  it("lists the venue's halls in the venue's order, each with how many sessions it holds", () => {
    const options = hallFilterOptions([hallB, hallA, lab], sessions);

    expect(options.map((option) => [option.label, option.hint])).toEqual([
      ["Lab 3", "0 sessions"],
      ["Hall A", "1 session"],
      ["Hall B", "1 session"],
      ["No hall (online)", "1 session"],
    ]);
    expect(options[1].value).toBe(HALL_A_ID);
    expect(options.at(-1)?.value).toBe(NO_HALL);
  });

  it("has no 'No hall' option when every session has a hall", () => {
    const options = hallFilterOptions([hallA, hallB], [talk, workshop]);

    expect(options.map((option) => option.value)).toEqual([
      HALL_A_ID,
      HALL_B_ID,
    ]);
  });

  it("adds a hall that sessions use but the venue's list does not hold, named by the session", () => {
    const options = hallFilterOptions([hallB], [talk, workshop]);

    expect(options.map((option) => option.label)).toEqual(["Hall B", "Hall A"]);
  });

  it("still works before the venue's halls have loaded: only the halls the sessions use", () => {
    const options = hallFilterOptions([], sessions);

    expect(options.map((option) => option.label).sort()).toEqual([
      "Hall A",
      "Hall B",
      "No hall (online)",
    ]);
  });

  it("is empty with no halls and no sessions", () => {
    expect(hallFilterOptions([], [])).toEqual([]);
  });
});

describe("filterSessionsByHall", () => {
  it("shows every session for all halls", () => {
    expect(filterSessionsByHall(sessions, ALL_HALLS)).toEqual(sessions);
  });

  it("shows only the sessions in the chosen hall", () => {
    expect(filterSessionsByHall(sessions, HALL_A_ID)).toEqual([talk]);
    expect(filterSessionsByHall(sessions, HALL_B_ID)).toEqual([workshop]);
  });

  it("shows the sessions with no hall for 'none'", () => {
    expect(filterSessionsByHall(sessions, NO_HALL)).toEqual([cancelledKeynote]);
  });

  it("shows nothing for a hall that holds no session", () => {
    expect(filterSessionsByHall(sessions, lab.id)).toEqual([]);
  });

  it("does not change the list it is given", () => {
    const before = [...sessions];
    filterSessionsByHall(sessions, HALL_A_ID);

    expect(sessions).toEqual(before);
  });
});
