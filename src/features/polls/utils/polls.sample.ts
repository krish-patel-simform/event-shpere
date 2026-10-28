import type { AudienceQuestion, Poll, PollSession } from "../types/poll.types";

// Static sample data for the live polls screen, until the polls API exists. Times are UTC.

/** "Now" for the sample: 14 minutes into the first session. */
export const POLLS_SAMPLE_NOW = "2026-12-04T10:16:00.000Z";

export const POLL_SESSIONS_SAMPLE: PollSession[] = [
  {
    id: "session-nextjs",
    title: "Scaling Next.js Applications",
    startsAt: "2026-12-04T10:00:00.000Z",
    live: {
      startedAt: "2026-12-04T10:02:00.000Z",
      attendeesConnected: 231,
    },
  },
  {
    id: "session-zod",
    title: "Hands-on: Type-safe APIs with TypeScript and Zod",
    startsAt: "2026-12-04T14:00:00.000Z",
    live: null,
  },
];

export const POLLS_SAMPLE: Poll[] = [
  {
    id: "poll-rendering",
    sessionId: "session-nextjs",
    question: "Which rendering strategy do you use most in production?",
    kind: "single",
    status: "live",
    options: [
      { id: "rendering-ssr", label: "Server-side rendering (SSR)", votes: 76 },
      {
        id: "rendering-ssg",
        label: "Static generation (SSG / ISR)",
        votes: 60,
      },
      { id: "rendering-csr", label: "Client-side rendering", votes: 33 },
      {
        id: "rendering-rsc",
        label: "Streaming with React Server Components",
        votes: 17,
      },
    ],
    responses: 186,
    openedAt: "2026-12-04T10:02:00.000Z",
    showResultsToAudience: true,
  },
  {
    id: "poll-codebase",
    sessionId: "session-nextjs",
    question: "How large is your team's Next.js codebase?",
    kind: "single",
    status: "draft",
    options: [
      { id: "codebase-small", label: "Under 50 files", votes: 0 },
      { id: "codebase-medium", label: "50 to 500 files", votes: 0 },
      { id: "codebase-large", label: "500 to 5,000 files", votes: 0 },
      { id: "codebase-huge", label: "More than 5,000 files", votes: 0 },
    ],
    responses: 0,
    openedAt: null,
    showResultsToAudience: true,
  },
  {
    id: "poll-rate",
    sessionId: "session-nextjs",
    question: "Rate this session",
    kind: "rating",
    status: "draft",
    options: ["1", "2", "3", "4", "5"].map((label) => ({
      id: `rate-${label}`,
      label,
      votes: 0,
    })),
    responses: 0,
    openedAt: null,
    showResultsToAudience: false,
  },
  {
    id: "poll-app-router",
    sessionId: "session-nextjs",
    question: "Have you used the App Router?",
    kind: "single",
    status: "closed",
    options: [
      { id: "app-router-yes", label: "Yes, in production", votes: 121 },
      { id: "app-router-trying", label: "Only in side projects", votes: 62 },
      { id: "app-router-no", label: "Not yet", votes: 21 },
    ],
    responses: 204,
    openedAt: "2026-12-04T10:03:00.000Z",
    showResultsToAudience: true,
  },
];

export const QUESTIONS_SAMPLE: AudienceQuestion[] = [
  {
    id: "question-cache",
    sessionId: "session-nextjs",
    text: "How do you handle cache invalidation when content editors publish from the CMS?",
    author: "Rahul S.",
    askedAt: "2026-12-04T10:12:00.000Z",
    upvotes: 38,
    answered: false,
  },
  {
    id: "question-vitals",
    sessionId: "session-nextjs",
    text: "Did moving to the App Router affect your Core Web Vitals?",
    author: null,
    askedAt: "2026-12-04T10:10:00.000Z",
    upvotes: 21,
    answered: false,
  },
  {
    id: "question-monitoring",
    sessionId: "session-nextjs",
    text: "Which error monitoring setup do you recommend for small teams?",
    author: "Neha K.",
    askedAt: "2026-12-04T10:07:00.000Z",
    upvotes: 14,
    answered: true,
  },
];
