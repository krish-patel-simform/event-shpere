import type {
  AudienceQuestion,
  Poll,
  PollStatus,
  QuestionSort,
} from "../types/poll.types";

// The state changes of the polls screen as pure functions, so the rules are tested without a
// component. The screen keeps the arrays in useState for now; a real API will replace them.

/** A draft can go live, a live poll can be closed, a closed poll stays closed. */
const ALLOWED_NEXT: Record<PollStatus, readonly PollStatus[]> = {
  draft: ["live"],
  live: ["closed"],
  closed: [],
};

export function canChangePollStatus(from: PollStatus, to: PollStatus): boolean {
  return ALLOWED_NEXT[from].includes(to);
}

/** Moves a poll to `next` when that is allowed; going live stamps `openedAt`. Never mutates. */
export function changePollStatus(
  polls: readonly Poll[],
  pollId: string,
  next: PollStatus,
  now: string,
): Poll[] {
  return polls.map((poll) => {
    if (poll.id !== pollId || !canChangePollStatus(poll.status, next)) {
      return poll;
    }
    return {
      ...poll,
      status: next,
      openedAt: next === "live" ? now : poll.openedAt,
    };
  });
}

export function setShowResultsToAudience(
  polls: readonly Poll[],
  pollId: string,
  show: boolean,
): Poll[] {
  return polls.map((poll) =>
    poll.id === pollId ? { ...poll, showResultsToAudience: show } : poll,
  );
}

export function setQuestionAnswered(
  questions: readonly AudienceQuestion[],
  questionId: string,
  answered: boolean,
): AudienceQuestion[] {
  return questions.map((question) =>
    question.id === questionId ? { ...question, answered } : question,
  );
}

/** Most upvoted first (newer first when tied), or newest first. Returns a new array. */
export function sortQuestions(
  questions: readonly AudienceQuestion[],
  sort: QuestionSort,
): AudienceQuestion[] {
  const byNewest = (a: AudienceQuestion, b: AudienceQuestion) =>
    new Date(b.askedAt).getTime() - new Date(a.askedAt).getTime();
  return [...questions].sort((a, b) =>
    sort === "top" ? b.upvotes - a.upvotes || byNewest(a, b) : byNewest(a, b),
  );
}

export type NewPollInput = {
  question: string;
  kind: Poll["kind"];
  options: readonly string[];
};

/** A new poll for a session: a draft, or live right away. Rating polls get the options 1 to 5. */
export function createPoll(
  input: NewPollInput,
  context: {
    id: string;
    sessionId: string;
    status: "draft" | "live";
    now: string;
  },
): Poll {
  const labels =
    input.kind === "rating" ? ["1", "2", "3", "4", "5"] : [...input.options];
  return {
    id: context.id,
    sessionId: context.sessionId,
    question: input.question,
    kind: input.kind,
    status: context.status,
    options: labels.map((label, index) => ({
      id: `${context.id}-option-${index + 1}`,
      label,
      votes: 0,
    })),
    responses: 0,
    openedAt: context.status === "live" ? context.now : null,
    showResultsToAudience: true,
  };
}
