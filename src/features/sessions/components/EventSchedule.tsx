"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Button, buttonStyles, Card } from "@/src/core/ui";
import {
  EventLoader,
  EventPageHeader,
  eventEditHref,
  isEventEditable,
  type EventOverviewData,
} from "../../events";
import { useGetVenueDetail } from "../../venues";
import { useGetEventSessions } from "../hooks/useGetEventSessions";
import { useMoveSession } from "../hooks/useMoveSession";
import { eventSessionEditHref, eventSessionNewHref } from "../routes";
import {
  eventDays,
  frameFor,
  type BoardSession,
} from "../utils/schedule-board";
import {
  toBoardHalls,
  toMoveRequest,
  toScheduleSessions,
} from "../utils/schedule-sessions";
import { OffBoardSessions } from "./OffBoardSessions";
import { ScheduleBoard } from "./ScheduleBoard";

/**
 * The organizer's Schedule board tab of one event: the day's programme as one column per hall
 * (the halls of the event's venue), where a session is moved by dragging it. The event loads
 * first (it names the venue and the days), then the venue's halls and the event's sessions; a move
 * is saved with PATCH /api/events/[eventId]/sessions/[sessionId].
 */
export function EventSchedule({ eventId }: { eventId: string }) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => <SchedulePage overview={overview} />}
    </EventLoader>
  );
}

function SchedulePage({ overview }: { overview: EventOverviewData }) {
  const { event } = overview;
  const editable = isEventEditable(event.status);
  const venue = event.venue;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader overview={overview} current="schedule" />

      {venue ? (
        <LiveSchedule overview={overview} venueId={venue.id} />
      ) : (
        <Alert tone="info" title="This event has no venue yet">
          The schedule board has one column for each hall of the event&apos;s
          venue.{" "}
          {editable && (
            <Link
              href={eventEditHref(event.id)}
              className="font-semibold underline"
            >
              Choose a venue
            </Link>
          )}
        </Alert>
      )}
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the schedule"
      className="animate-pulse space-y-3 rounded-lg border border-line bg-surface p-5 motion-reduce:animate-none"
    >
      <div className="h-10 w-2/3 rounded bg-surface-subtle" />
      <div className="h-96 rounded bg-surface-subtle" />
    </div>
  );
}

function LiveSchedule({
  overview,
  venueId,
}: {
  overview: EventOverviewData;
  venueId: string;
}) {
  const { event } = overview;
  const editable = isEventEditable(event.status);
  const venue = useGetVenueDetail(venueId);
  const sessions = useGetEventSessions(event.id);
  const moveSession = useMoveSession(event.id);

  // The page's clock: a session whose end has passed can not be moved.
  const [now] = useState(() => new Date());
  const days = useMemo(
    () => eventDays(event.startAt, event.endAt, event.timezone),
    [event.startAt, event.endAt, event.timezone],
  );
  const halls = useMemo(
    () => toBoardHalls(venue.data?.halls ?? []),
    [venue.data],
  );
  const { placed, other } = useMemo(
    () =>
      toScheduleSessions(sessions.data ?? [], {
        days,
        halls,
        timezone: event.timezone,
        now,
        locked: !editable,
      }),
    [sessions.data, days, halls, event.timezone, now, editable],
  );

  const createLink = editable && (
    <Link
      href={eventSessionNewHref(event.id)}
      className={buttonStyles({ variant: "secondary" })}
    >
      <Plus aria-hidden="true" className="size-4" />
      Create session
    </Link>
  );

  if (venue.isPending || sessions.isPending) return <ScheduleSkeleton />;

  if (venue.isError || sessions.isError) {
    const failed = venue.isError ? venue : sessions;
    return (
      <Alert tone="error" title="We couldn't load the schedule">
        {failed.error?.message}
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => {
            if (venue.isError) void venue.refetch();
            if (sessions.isError) void sessions.refetch();
          }}
        >
          Try again
        </Button>
      </Alert>
    );
  }

  if (halls.length === 0) {
    return (
      <Alert tone="info" title="This venue has no halls yet">
        An administrator adds halls to the venue, and then they appear here as
        columns.
      </Alert>
    );
  }

  /** Saves a move; the session list shows it at once and takes it back when the server refuses. */
  async function onMove(moved: BoardSession) {
    await moveSession.mutateAsync({
      sessionId: moved.id,
      move: toMoveRequest(moved, days),
      hallName: halls.find((hall) => hall.id === moved.hallId)?.name ?? null,
    });
  }

  return (
    <>
      {!editable && (
        <Alert tone="info">
          This event can no longer be changed, so its sessions can&apos;t be
          moved.
        </Alert>
      )}
      {other.length > 0 && (
        <OffBoardSessions
          eventId={event.id}
          sessions={other}
          timezone={event.timezone}
        />
      )}
      <Card title="Schedule" action={createLink || undefined}>
        <ScheduleBoard
          days={days}
          halls={halls}
          sessions={placed}
          frame={frameFor(placed)}
          onMove={onMove}
          editHref={(sessionId) => eventSessionEditHref(event.id, sessionId)}
        />
      </Card>
    </>
  );
}
