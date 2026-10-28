// Shapes of the speaker's live polls screen. UI only for now: there is no polls API yet, so
// these are plain types for the sample data, not DTOs from a Zod schema.

export type PollStatus = "draft" | "live" | "closed";
export type PollKind = "single" | "multiple" | "rating";

export type PollOption = {
  id: string;
  label: string;
  votes: number;
};

export type Poll = {
  id: string;
  sessionId: string;
  question: string;
  kind: PollKind;
  status: PollStatus;
  options: PollOption[];
  /** How many people answered (for a multiple choice poll this is less than the votes added up). */
  responses: number;
  /** When the poll went live (ISO, UTC); null for a draft. */
  openedAt: string | null;
  /** Whether the audience sees the results while the poll is live. */
  showResultsToAudience: boolean;
};

export type PollSession = {
  id: string;
  title: string;
  /** ISO, UTC. */
  startsAt: string;
  /** Null when the session is not running now. */
  live: { startedAt: string; attendeesConnected: number } | null;
};

export type AudienceQuestion = {
  id: string;
  sessionId: string;
  text: string;
  /** Null = asked anonymously. */
  author: string | null;
  /** ISO, UTC. */
  askedAt: string;
  upvotes: number;
  answered: boolean;
};

export type QuestionSort = "top" | "new";
