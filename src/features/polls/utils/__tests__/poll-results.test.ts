import { closedPoll, draftPoll, livePoll } from "../../__fixtures__/polls";
import type { Poll } from "../../types/poll.types";
import { pollResults, roomShare } from "../poll-results";

describe("pollResults", () => {
  it("gives a percent and the votes for each option, in the written order", () => {
    expect(pollResults(livePoll)).toEqual([
      { id: "o1", label: "Next.js", votes: 60, percent: 60, isLeader: true },
      { id: "o2", label: "Remix", votes: 30, percent: 30, isLeader: false },
      { id: "o3", label: "Astro", votes: 10, percent: 10, isLeader: false },
    ]);
  });

  it("rounds to whole percents", () => {
    const rows = pollResults({ ...closedPoll, responses: 3 });
    expect(rows.map((row) => row.percent)).toEqual([100, 33]);
  });

  it("shows 0% and no leader while nobody has answered", () => {
    const rows = pollResults(draftPoll);
    expect(rows.every((row) => row.percent === 0 && !row.isLeader)).toBe(true);
  });

  it("marks every option that ties for the most votes", () => {
    const tied: Poll = {
      ...livePoll,
      options: [
        { id: "a", label: "A", votes: 5 },
        { id: "b", label: "B", votes: 5 },
        { id: "c", label: "C", votes: 1 },
      ],
      responses: 11,
    };
    expect(pollResults(tied).map((row) => row.isLeader)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("works on the share of people who answered, so multiple choice may pass 100 together", () => {
    const multiple: Poll = {
      ...livePoll,
      kind: "multiple",
      options: [
        { id: "a", label: "A", votes: 8 },
        { id: "b", label: "B", votes: 7 },
      ],
      responses: 10,
    };
    expect(pollResults(multiple).map((row) => row.percent)).toEqual([80, 70]);
  });
});

describe("roomShare", () => {
  it("is the percent of the room that answered", () => {
    expect(roomShare(186, 231)).toBe(81);
  });

  it("is 0 when nobody is connected", () => {
    expect(roomShare(5, 0)).toBe(0);
  });

  it("never passes 100", () => {
    expect(roomShare(300, 200)).toBe(100);
  });
});
