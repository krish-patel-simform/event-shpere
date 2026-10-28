import {
  closedPoll,
  draftPoll,
  livePoll,
  NOW,
  polls,
  questionNew,
  questionTop,
  questions,
} from "../../__fixtures__/polls";
import {
  canChangePollStatus,
  changePollStatus,
  createPoll,
  setQuestionAnswered,
  setShowResultsToAudience,
  sortQuestions,
} from "../poll-state";

describe("canChangePollStatus", () => {
  it("lets a draft go live and a live poll close, nothing else", () => {
    expect(canChangePollStatus("draft", "live")).toBe(true);
    expect(canChangePollStatus("live", "closed")).toBe(true);
    expect(canChangePollStatus("draft", "closed")).toBe(false);
    expect(canChangePollStatus("closed", "live")).toBe(false);
    expect(canChangePollStatus("live", "live")).toBe(false);
  });
});

describe("changePollStatus", () => {
  it("launches a draft and stamps when it opened", () => {
    const result = changePollStatus(polls, draftPoll.id, "live", NOW);
    const launched = result.find((poll) => poll.id === draftPoll.id);
    expect(launched).toMatchObject({ status: "live", openedAt: NOW });
  });

  it("closes a live poll and keeps when it opened", () => {
    const result = changePollStatus(polls, livePoll.id, "closed", NOW);
    expect(result.find((poll) => poll.id === livePoll.id)).toMatchObject({
      status: "closed",
      openedAt: livePoll.openedAt,
    });
  });

  it("does not reopen a closed poll", () => {
    const result = changePollStatus(polls, closedPoll.id, "live", NOW);
    expect(result.find((poll) => poll.id === closedPoll.id)).toBe(closedPoll);
  });

  it("changes only the chosen poll and does not mutate the input", () => {
    const result = changePollStatus(polls, livePoll.id, "closed", NOW);
    expect(result.find((poll) => poll.id === draftPoll.id)).toBe(draftPoll);
    expect(livePoll.status).toBe("live");
    expect(result).not.toBe(polls);
  });
});

describe("setShowResultsToAudience", () => {
  it("sets the flag on one poll", () => {
    const result = setShowResultsToAudience(polls, livePoll.id, false);
    expect(
      result.find((poll) => poll.id === livePoll.id)?.showResultsToAudience,
    ).toBe(false);
    expect(result.find((poll) => poll.id === draftPoll.id)).toBe(draftPoll);
  });
});

describe("setQuestionAnswered", () => {
  it("marks one question answered and back", () => {
    const answered = setQuestionAnswered(questions, questionTop.id, true);
    expect(answered.find((q) => q.id === questionTop.id)?.answered).toBe(true);
    expect(answered.find((q) => q.id === questionNew.id)).toBe(questionNew);

    const undone = setQuestionAnswered(answered, questionTop.id, false);
    expect(undone.find((q) => q.id === questionTop.id)?.answered).toBe(false);
  });
});

describe("sortQuestions", () => {
  it("puts the most upvoted first", () => {
    expect(sortQuestions(questions, "top").map((q) => q.id)).toEqual([
      "q-top",
      "q-new",
    ]);
  });

  it("puts the newest first", () => {
    expect(
      sortQuestions([questionTop, questionNew], "new").map((q) => q.id),
    ).toEqual(["q-new", "q-top"]);
  });

  it("breaks a tie in upvotes with the newer question and does not mutate", () => {
    const older = { ...questionTop, id: "older", upvotes: 5 };
    const newer = { ...questionNew, id: "newer", upvotes: 5 };
    const input = [older, newer];
    expect(sortQuestions(input, "top").map((q) => q.id)).toEqual([
      "newer",
      "older",
    ]);
    expect(input.map((q) => q.id)).toEqual(["older", "newer"]);
  });
});

describe("createPoll", () => {
  const context = { id: "p1", sessionId: "s-live", now: NOW };

  it("makes a draft with the written options and no votes", () => {
    const poll = createPoll(
      { question: "Q?", kind: "single", options: ["A", "B"] },
      { ...context, status: "draft" },
    );
    expect(poll).toMatchObject({
      status: "draft",
      openedAt: null,
      responses: 0,
      sessionId: "s-live",
    });
    expect(poll.options).toEqual([
      { id: "p1-option-1", label: "A", votes: 0 },
      { id: "p1-option-2", label: "B", votes: 0 },
    ]);
  });

  it("makes a live poll with the time it opened", () => {
    const poll = createPoll(
      { question: "Q?", kind: "multiple", options: ["A", "B"] },
      { ...context, status: "live" },
    );
    expect(poll).toMatchObject({ status: "live", openedAt: NOW });
  });

  it("gives a rating poll the options 1 to 5", () => {
    const poll = createPoll(
      { question: "Rate", kind: "rating", options: [] },
      { ...context, status: "draft" },
    );
    expect(poll.options.map((option) => option.label)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });
});
