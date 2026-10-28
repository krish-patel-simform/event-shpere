import type { Poll } from "../types/poll.types";

export type ResultRow = {
  id: string;
  label: string;
  votes: number;
  /** Whole percent of the people who answered (0 when nobody did). */
  percent: number;
  /** The option(s) with the most votes. Nobody leads while there are no votes. */
  isLeader: boolean;
};

/**
 * One row per option, in the order the speaker wrote them. The percent is the share of the
 * people who answered, so a multiple choice poll can add up to more than 100.
 */
export function pollResults(poll: Poll): ResultRow[] {
  const topVotes = Math.max(0, ...poll.options.map((option) => option.votes));
  return poll.options.map((option) => ({
    id: option.id,
    label: option.label,
    votes: option.votes,
    percent:
      poll.responses > 0
        ? Math.min(100, Math.round((option.votes / poll.responses) * 100))
        : 0,
    isLeader: topVotes > 0 && option.votes === topVotes,
  }));
}

/** Whole percent of the people in the room who answered; 0 when nobody is connected. */
export function roomShare(responses: number, attendees: number): number {
  return attendees > 0
    ? Math.min(100, Math.round((responses / attendees) * 100))
    : 0;
}
