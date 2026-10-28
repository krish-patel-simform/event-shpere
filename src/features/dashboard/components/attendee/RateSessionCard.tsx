import Link from "next/link";
import { buttonStyles, Card } from "@/src/core/ui";
import type { AttendeeRatingPrompt } from "../../types/attendee-home";
import { formatDayMonth } from "../../utils/home-format";
import { EmptyState } from "../EmptyState";

/** Nudges the attendee to rate a session they attended. The rating form itself is its own page. */
export function RateSessionCard({
  prompt,
}: {
  prompt: AttendeeRatingPrompt | null;
}) {
  return (
    <Card title="Rate your session" flush={prompt === null}>
      {prompt ? (
        <div className="flex flex-col gap-3.5">
          <div>
            <p className="font-medium">{prompt.sessionTitle}</p>
            <p className="text-sm text-muted">
              {prompt.eventTitle}, {formatDayMonth(prompt.eventDate)}
            </p>
          </div>
          {/* TODO(API): the star rating form needs the feedback endpoint; until then this links on. */}
          <Link
            href="/my-schedule"
            className={buttonStyles({ variant: "primary", fullWidth: true })}
          >
            Give feedback
          </Link>
        </div>
      ) : (
        <EmptyState>No sessions to rate right now.</EmptyState>
      )}
    </Card>
  );
}
