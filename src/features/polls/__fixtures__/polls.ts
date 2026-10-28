import type { AudienceQuestion, Poll, PollSession } from "../types/poll.types";

// Data only the tests use (the screen's own sample data is in utils/polls.sample.ts).

export const NOW = "2026-12-04T10:20:00.000Z";

export const liveSession: PollSession = {
  id: "s-live",
  title: "Live talk",
  startsAt: "2026-12-04T10:00:00.000Z",
  live: { startedAt: "2026-12-04T10:02:00.000Z", attendeesConnected: 200 },
};

export const laterSession: PollSession = {
  id: "s-later",
  title: "Afternoon workshop",
  startsAt: "2026-12-04T14:00:00.000Z",
  live: null,
};

export const livePoll: Poll = {
  id: "p-live",
  sessionId: "s-live",
  question: "Which framework do you use?",
  kind: "single",
  status: "live",
  options: [
    { id: "o1", label: "Next.js", votes: 60 },
    { id: "o2", label: "Remix", votes: 30 },
    { id: "o3", label: "Astro", votes: 10 },
  ],
  responses: 100,
  openedAt: "2026-12-04T10:05:00.000Z",
  showResultsToAudience: true,
};

export const draftPoll: Poll = {
  id: "p-draft",
  sessionId: "s-live",
  question: "Team size?",
  kind: "single",
  status: "draft",
  options: [
    { id: "d1", label: "Small", votes: 0 },
    { id: "d2", label: "Large", votes: 0 },
  ],
  responses: 0,
  openedAt: null,
  showResultsToAudience: true,
};

export const closedPoll: Poll = {
  id: "p-closed",
  sessionId: "s-live",
  question: "Used the App Router?",
  kind: "single",
  status: "closed",
  options: [
    { id: "c1", label: "Yes", votes: 3 },
    { id: "c2", label: "No", votes: 1 },
  ],
  responses: 4,
  openedAt: "2026-12-04T10:03:00.000Z",
  showResultsToAudience: true,
};

export const polls: Poll[] = [livePoll, draftPoll, closedPoll];

export const questionTop: AudienceQuestion = {
  id: "q-top",
  sessionId: "s-live",
  text: "Most upvoted question?",
  author: "Rahul S.",
  askedAt: "2026-12-04T10:10:00.000Z",
  upvotes: 30,
  answered: false,
};

export const questionNew: AudienceQuestion = {
  id: "q-new",
  sessionId: "s-live",
  text: "Newest question?",
  author: null,
  askedAt: "2026-12-04T10:18:00.000Z",
  upvotes: 2,
  answered: false,
};

export const questions: AudienceQuestion[] = [questionNew, questionTop];
