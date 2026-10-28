import { Card } from "@/src/core/ui";
import { formatCount } from "@/src/core/format/format-number";
import type { SpeakerFeedback } from "../../types/speaker-home";
import { EmptyState } from "../EmptyState";
import { ProgressBar } from "../ProgressBar";

const STARS = [5, 4, 3, 2, 1] as const;

/** Ratings for the speaker's latest finished session: average, spread and one comment. */
export function FeedbackCard({
  feedback,
}: {
  feedback: SpeakerFeedback | null;
}) {
  if (!feedback) {
    return (
      <Card title="Attendee feedback" flush>
        <EmptyState>
          No ratings yet. They appear after your first session.
        </EmptyState>
      </Card>
    );
  }

  const { average, ratingCount, breakdown, quote } = feedback;

  return (
    <Card
      title="Attendee feedback"
      description={`${feedback.sessionTitle} · ${feedback.eventTitle}`}
    >
      <div className="flex items-center gap-5">
        <div className="text-center">
          <p className="text-4xl font-semibold leading-none">
            {average.toFixed(1)}
          </p>
          <p
            role="img"
            aria-label={`${average.toFixed(1)} out of 5 stars`}
            className="text-sm tracking-wide text-warning"
          >
            ★★★★★
          </p>
          <p className="text-xs text-muted">
            {formatCount(ratingCount)} ratings
          </p>
        </div>
        <ul
          aria-label="Rating breakdown"
          className="flex flex-1 flex-col gap-1.5"
        >
          {STARS.map((stars) => (
            <li
              key={stars}
              className="grid grid-cols-[1.75rem_1fr_2.5rem] items-center gap-2 text-xs"
            >
              <span aria-hidden="true">{stars}★</span>
              <ProgressBar
                value={breakdown[stars]}
                max={100}
                label={`${stars} ${stars === 1 ? "star" : "stars"}`}
              />
              <span className="text-right text-muted">{breakdown[stars]}%</span>
            </li>
          ))}
        </ul>
      </div>
      {quote && (
        <blockquote className="mt-4 rounded-md bg-surface-subtle px-3.5 py-3 text-sm">
          “{quote.text}”
          <footer className="mt-1 text-xs text-muted">
            Attendee · {quote.rating}★
          </footer>
        </blockquote>
      )}
    </Card>
  );
}
