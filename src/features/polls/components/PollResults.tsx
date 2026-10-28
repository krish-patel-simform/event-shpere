import { formatCount } from "@/src/core/format/format-number";
import { Button, Card } from "@/src/core/ui";
import type { Poll, PollStatus } from "../types/poll.types";
import { POLL_KIND_LABEL } from "../utils/poll-labels";
import { pollResults, roomShare } from "../utils/poll-results";
import { formatOpenFor } from "../utils/poll-time";
import { PollStatusBadge } from "./PollStatusBadge";

const STATUS_LABEL: Record<PollStatus, string> = {
  live: "Live poll",
  draft: "Draft poll",
  closed: "Closed poll",
};

/**
 * One poll with its results: a bar per option, with the percent and the number of votes written
 * next to it (the bar alone says nothing to a screen reader). The speaker launches a draft or
 * closes a live poll here and decides whether the audience sees the results.
 */
export function PollResults({
  poll,
  attendeesConnected,
  now,
  onChangeStatus,
  onToggleShowResults,
}: {
  poll: Poll;
  /** People connected to the session now; null when it is not live. */
  attendeesConnected: number | null;
  /** The current time (ISO), so "open for" is the same on every render and in tests. */
  now: string;
  onChangeStatus: (status: "live" | "closed") => void;
  onToggleShowResults: (show: boolean) => void;
}) {
  const rows = pollResults(poll);
  const share =
    attendeesConnected !== null
      ? roomShare(poll.responses, attendeesConnected)
      : null;

  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <PollStatusBadge status={poll.status} />
            <p className="text-sm text-muted">
              {STATUS_LABEL[poll.status]} · {POLL_KIND_LABEL[poll.kind]}
            </p>
          </div>
          <h2 className="text-lg font-semibold">{poll.question}</h2>
        </div>
        <div className="text-right">
          {/* Announced politely as the number changes once results stream in. */}
          <p aria-live="polite" className="text-2xl font-semibold">
            {formatCount(poll.responses)}
          </p>
          <p className="text-sm text-muted">
            {poll.responses === 1 ? "response" : "responses"}
            {share !== null && poll.status !== "draft"
              ? ` · ${share}% of room`
              : ""}
          </p>
        </div>
      </div>

      {poll.status === "draft" && (
        <p className="mt-4 text-sm text-muted">
          Nobody can answer a draft. Launch it when you are ready.
        </p>
      )}

      <ul aria-label="Results" className="mt-5 space-y-4">
        {rows.map((row) => (
          <li key={row.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className={row.isLeader ? "font-semibold" : undefined}>
                {row.label}
                {row.isLeader && <span className="sr-only"> (most votes)</span>}
              </span>
              <span className="shrink-0 font-semibold">
                {row.percent}%{" "}
                <span className="font-normal text-muted">
                  · {formatCount(row.votes)}{" "}
                  {row.votes === 1 ? "vote" : "votes"}
                </span>
              </span>
            </div>
            <span
              aria-hidden="true"
              className="block h-2.5 overflow-hidden rounded bg-surface-subtle"
            >
              <span
                className="block h-full rounded bg-brand"
                style={{ width: `${row.percent}%` }}
              />
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-line pt-4">
        <p className="text-sm text-muted">
          {poll.status === "live" && poll.openedAt
            ? `Open for ${formatOpenFor(poll.openedAt, now)}`
            : poll.status === "closed"
              ? "This poll is closed."
              : "Not launched yet."}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={poll.showResultsToAudience}
            onChange={(event) => onToggleShowResults(event.target.checked)}
            className="size-4"
          />
          Show results to audience
        </label>
        {poll.status === "live" && (
          <Button variant="danger" onClick={() => onChangeStatus("closed")}>
            Close poll
          </Button>
        )}
        {poll.status === "draft" && (
          <Button onClick={() => onChangeStatus("live")}>Launch poll</Button>
        )}
      </div>
    </Card>
  );
}
