import { CircleDot } from "lucide-react";
import Link from "next/link";
import { Badge, Card, Timeline, type TimelineItem } from "@/src/core/ui";
import type {
  AttendeeSchedule,
  AttendeeScheduleEntry,
} from "../../types/attendee-home";
import {
  formatTimeRange,
  formatWeekdayDayMonth,
} from "../../utils/home-format";
import { EmptyState } from "../EmptyState";

function toTimelineItem(entry: AttendeeScheduleEntry): TimelineItem {
  const time = formatTimeRange(entry.startsAt, entry.endsAt);

  if (entry.kind === "break") {
    return {
      title: (
        <span className="text-muted">
          {time} · {entry.title}
        </span>
      ),
    };
  }

  return {
    done: true,
    title: (
      <span className="flex flex-wrap items-start justify-between gap-2">
        <span className="font-semibold">
          {time} · {entry.title}
        </span>
        <Badge tone="success">Booked</Badge>
      </span>
    ),
    detail: (
      <>
        {entry.location}
        {entry.location && entry.speakers.length > 0 && " · "}
        {entry.speakers.map((speaker, index) => (
          <span key={speaker.slug}>
            {index > 0 && ", "}
            <Link
              href={`/speakers/${speaker.slug}`}
              className="font-medium text-link hover:underline"
            >
              {speaker.name}
            </Link>
          </span>
        ))}
      </>
    ),
  };
}

/** The attendee's booked sessions for one day, in time order, with the gaps between them. */
export function MyScheduleCard({
  schedule,
}: {
  schedule: AttendeeSchedule | null;
}) {
  const hasSessions = schedule?.entries.some(
    (entry) => entry.kind === "session",
  );

  return (
    <Card
      title="My schedule"
      description={
        schedule &&
        `${schedule.eventTitle} · ${formatWeekdayDayMonth(schedule.day)}`
      }
      action={
        <Link href="/my-schedule" className="text-sm font-semibold text-link">
          Full schedule
        </Link>
      }
      flush
    >
      {schedule && hasSessions ? (
        <>
          <div className="p-5">
            <Timeline items={schedule.entries.map(toTimelineItem)} />
          </div>
          <p className="flex items-center gap-2 border-t border-line bg-surface-subtle px-5 py-3 text-sm text-muted">
            <CircleDot aria-hidden="true" className="size-4 shrink-0" />
            Live polls for these sessions will appear here while they&apos;re
            running.
          </p>
        </>
      ) : (
        <EmptyState>
          No sessions booked yet. Add sessions from an event&apos;s schedule.
        </EmptyState>
      )}
    </Card>
  );
}
