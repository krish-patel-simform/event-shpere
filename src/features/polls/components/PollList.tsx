import { BarChart3 } from "lucide-react";
import { Card, cn } from "@/src/core/ui";
import { formatCount } from "@/src/core/format/format-number";
import type { Poll } from "../types/poll.types";
import { POLL_KIND_LABEL as KIND_LABEL } from "../utils/poll-labels";
import { PollStatusBadge } from "./PollStatusBadge";

/** The line under the question: how many answered, or what the poll will ask. */
function pollDetail(poll: Poll): string {
  if (poll.status !== "draft") {
    return `${formatCount(poll.responses)} ${poll.responses === 1 ? "response" : "responses"}`;
  }
  return poll.kind === "rating"
    ? KIND_LABEL.rating
    : `${poll.options.length} options · ${KIND_LABEL[poll.kind]}`;
}

/** The polls of the chosen session; picking one shows its results next to the list. */
export function PollList({
  polls,
  selectedId,
  onSelect,
}: {
  polls: readonly Poll[];
  selectedId: string | undefined;
  onSelect: (pollId: string) => void;
}) {
  return (
    <Card
      title="Polls"
      description={`${polls.length} total`}
      flush
      className="min-w-0"
    >
      {polls.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <BarChart3 aria-hidden="true" className="size-8 text-muted" />
          <p className="font-semibold">No polls for this session yet</p>
          <p className="text-sm text-muted">
            Create one below, save it as a draft or launch it right away.
          </p>
        </div>
      ) : (
        <ul>
          {polls.map((poll) => {
            const selected = poll.id === selectedId;
            return (
              <li
                key={poll.id}
                className="border-b border-line last:border-b-0"
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(poll.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-1.5 px-5 py-3 text-left hover:bg-surface-subtle",
                    selected && "bg-brand-soft hover:bg-brand-soft",
                  )}
                >
                  <PollStatusBadge status={poll.status} />
                  <span className="font-semibold">{poll.question}</span>
                  <span className="text-sm text-muted">{pollDetail(poll)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
