"use client";

import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { Alert, Badge, Button, buttonStyles, Card } from "@/src/core/ui";
import {
  SessionAttendeeList,
  type AttendeeListSession,
} from "@/src/features/registrations";
import {
  eventCheckInHref,
  EventLoader,
  EventPageHeader,
  eventSessionsHref,
  useCanEditEvent,
  publicSessionHref,
  type EventOverviewData,
} from "../../events";
import { useGetVenueDetail } from "../../venues";
import { useGetSession } from "../hooks/useGetSession";
import { eventSessionEditHref } from "../routes";
import type { SessionDto } from "../schemas/sessions.schemas";
import {
  hasPublicPage,
  sessionDay,
  sessionPlace,
  sessionPrice,
  sessionTimes,
  SESSION_MODE_LABELS,
  SESSION_STATUS_META,
  SESSION_TYPE_LABELS,
  speakerNames,
} from "../utils/organizer-session-display";

/**
 * One session of an event, for its organizer or an admin: the event's header and tabs, the
 * session's facts with an explicit "Edit session", and who booked a seat (route 10). This is what
 * a click on a session row opens, so every session (also a cancelled one, or one of an event that
 * has ended) has a page: editing is a separate action, offered only while the session can change.
 */
export function EventSessionDetail({
  eventId,
  sessionId,
}: {
  eventId: string;
  sessionId: string;
}) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => (
        <SessionDetailPage overview={overview} sessionId={sessionId} />
      )}
    </EventLoader>
  );
}

function SessionDetailPage({
  overview,
  sessionId,
}: {
  overview: EventOverviewData;
  sessionId: string;
}) {
  const { event } = overview;
  const session = useGetSession(event.id, sessionId);
  const listHref = eventSessionsHref(event.id);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader overview={overview} current="sessions" />
      <Link
        href={listHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-link hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All sessions
      </Link>

      {session.isPending ? (
        <div
          role="status"
          aria-label="Loading session"
          className="h-40 animate-pulse rounded-lg bg-surface-subtle motion-reduce:animate-none"
        />
      ) : session.isError ? (
        <SessionLoadError
          notFound={
            session.error instanceof ApiError && session.error.status === 404
          }
          message={session.error.message}
          onRetry={() => void session.refetch()}
          listHref={listHref}
        />
      ) : (
        <>
          <SessionFacts session={session.data} overview={overview} />
          <SessionAttendees session={session.data} event={event} />
        </>
      )}
    </div>
  );
}

function SessionLoadError({
  notFound,
  message,
  onRetry,
  listHref,
}: {
  notFound: boolean;
  message: string;
  onRetry: () => void;
  listHref: string;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <Alert
        tone="error"
        title={notFound ? "Session not found" : "We couldn't load this session"}
      >
        {notFound
          ? "It may have been removed, or it is not in this event."
          : message}
      </Alert>
      <div className="flex flex-wrap gap-2.5">
        {!notFound && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Link
          href={listHref}
          className={buttonStyles({ variant: "secondary" })}
        >
          Back to sessions
        </Link>
      </div>
    </div>
  );
}

/** The session's title, type, status, slot, place, speakers and price, with what can be done. */
function SessionFacts({
  session,
  overview,
}: {
  session: SessionDto;
  overview: EventOverviewData;
}) {
  const { event } = overview;
  const status = SESSION_STATUS_META[session.status];
  const day = sessionDay(session, event.timezone);
  const times = sessionTimes(session, event.timezone);
  const speakers = speakerNames(session);
  // The same rule as the Sessions tab: a cancelled session, or any session of an event that can
  // no longer change, is read-only.
  const editable =
    useCanEditEvent(event.status) && session.status !== "cancelled";

  return (
    <Card title={session.title}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{SESSION_TYPE_LABELS[session.type]}</Badge>
            <Badge tone="neutral">{SESSION_MODE_LABELS[session.mode]}</Badge>
            <Badge tone={status.tone}>
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-current"
              />
              {status.label}
            </Badge>
          </div>
          <p className="text-sm">
            {day && times ? `${day} · ${times}` : "Not scheduled yet"}
            {" · "}
            {sessionPlace(session)}
          </p>
          <p className="text-sm text-muted">
            {speakers || "No speakers yet"} · {sessionPrice(session)}
          </p>
          {session.status === "cancelled" && (
            <p className="text-sm text-danger">
              This session was cancelled. Its seats were released.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <Link
              href={eventSessionEditHref(event.id, session.id)}
              className={buttonStyles({ variant: "primary" })}
            >
              <Pencil aria-hidden="true" className="size-4" />
              Edit session
            </Link>
          )}
          {hasPublicPage(session, event.status) && (
            <a
              href={publicSessionHref(event.slug, session.id)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: "secondary" })}
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              View public page
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * "Who booked a seat" with the session's check-in door, and the hall's capacity when the session
 * has a hall.
 */
function SessionAttendees({
  session,
  event,
}: {
  session: SessionDto;
  event: EventOverviewData["event"];
}) {
  const timezone = event.timezone;
  const venueId = event.venue?.id ?? null;
  const list = {
    eventId: session.eventId,
    sessionId: session.id,
    timezone,
    door: {
      status: session.status,
      startAt: session.startAt,
      endAt: session.endAt,
      eventStatus: event.status,
      place: sessionPlace(session),
    },
    eventDoorHref: eventCheckInHref(session.eventId),
  };

  if (!session.requiresRegistration) {
    return (
      <Alert tone="info" title="No booking needed for this session">
        Anyone with an event ticket can walk in, so there are no seats to list.
      </Alert>
    );
  }
  return (
    <section aria-labelledby="session-attendees" className="space-y-3">
      <h2 id="session-attendees" className="text-lg font-semibold">
        Who booked a seat
      </h2>
      {session.hallId && venueId ? (
        <ListWithHallCapacity
          list={list}
          venueId={venueId}
          hallId={session.hallId}
        />
      ) : (
        <SessionAttendeeList session={{ ...list, hallCapacity: null }} />
      )}
    </section>
  );
}

/** The list, with the seats of the session's hall from the venue (undefined while it loads). */
function ListWithHallCapacity({
  list,
  venueId,
  hallId,
}: {
  list: Omit<AttendeeListSession, "hallCapacity">;
  venueId: string;
  hallId: string;
}) {
  const venue = useGetVenueDetail(venueId);
  const hallCapacity = venue.data
    ? (venue.data.halls.find((hall) => hall.id === hallId)?.capacity ?? null)
    : undefined;

  return <SessionAttendeeList session={{ ...list, hallCapacity }} />;
}
