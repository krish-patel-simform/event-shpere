"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Button, buttonStyles } from "@/src/core/ui";
import { useHasPermission } from "@/src/features/auth";
import {
  EventLoader,
  EventPageHeader,
  eventSessionsHref,
  isEventEditable,
  plural,
  SearchBox,
  type EventOverviewData,
} from "../../events";
import { useCancelSession } from "../hooks/useCancelSession";
import { useGetEventSessions } from "../hooks/useGetEventSessions";
import { eventSessionNewHref } from "../routes";
import type { SessionDto } from "../schemas/sessions.schemas";
import { ALL_HALLS, filterSessionsByHall } from "../utils/session-hall-filter";
import { filterSessionsBySearch } from "../utils/session-search-filter";
import {
  filterSessionsBySpeaker,
  speakerNameIn,
} from "../utils/session-speaker-filter";
import { CancelSessionDialog } from "./CancelSessionDialog";
import { EventSessionsTable } from "./EventSessionsTable";
import { SessionHallFilter } from "./SessionHallFilter";

/**
 * The organizer's Sessions tab of one event (GET /api/events/[id]/sessions): every session with
 * its slot, hall, speakers, price and status, an "Add session" button, and cancelling. The event
 * loads first (it gives the header, the zone the times are shown in, and whether it can still
 * change); a new load shows the skeleton, never old rows.
 */
export function EventSessions({
  eventId,
  speakerId,
}: {
  eventId: string;
  /** From `?speaker=`: only this speaker's sessions are shown. The URL holds it, so it survives a reload. */
  speakerId?: string;
}) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => <SessionsPage overview={overview} speakerId={speakerId} />}
    </EventLoader>
  );
}

function SessionsPage({
  overview,
  speakerId,
}: {
  overview: EventOverviewData;
  speakerId?: string;
}) {
  const { event } = overview;
  const canCreate = useHasPermission("SESSION_CREATE");
  const editable = isEventEditable(event.status);

  const sessions = useGetEventSessions(event.id);
  const cancel = useCancelSession(event.id);
  const [cancelling, setCancelling] = useState<SessionDto | null>(null);

  // The hall filter narrows the loaded rows in the browser: no request, so no loading state.
  const [hall, setHall] = useState(ALL_HALLS);
  // The chosen hall's name, as the dropdown showed it: "No session is in Lab 3." even for a hall
  // that has no session at all (it is not among the halls the sessions use).
  const [hallName, setHallName] = useState<string | null>(null);
  function chooseHall(id: string, name: string | null) {
    setHall(id);
    setHallName(name);
  }
  const allSessions = sessions.data;
  // The speaker (from the URL) narrows first, then the hall.
  const ofSpeaker = useMemo(
    () =>
      allSessions && speakerId
        ? filterSessionsBySpeaker(allSessions, speakerId)
        : (allSessions ?? []),
    [allSessions, speakerId],
  );
  // Then the typed search (title, hall or speaker name), also in the browser.
  const [search, setSearch] = useState("");
  const term = search.trim();
  const shown = useMemo(
    () => filterSessionsBySearch(filterSessionsByHall(ofSpeaker, hall), term),
    [ofSpeaker, hall, term],
  );
  const speakerName =
    speakerId && allSessions
      ? (speakerNameIn(allSessions, speakerId) ?? "this speaker")
      : null;
  const filtered = hall !== ALL_HALLS || speakerId !== undefined || term !== "";

  function closeDialog() {
    setCancelling(null);
    cancel.reset();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader
        overview={overview}
        current="sessions"
        actions={
          editable &&
          canCreate && (
            <Link
              href={eventSessionNewHref(event.id)}
              className={buttonStyles({ variant: "primary" })}
            >
              <Plus aria-hidden="true" className="size-4" />
              Add session
            </Link>
          )
        }
      />

      {!editable && (
        <Alert tone="info" title="Sessions are read-only">
          {event.status === "cancelled"
            ? "This event is cancelled."
            : "This event has ended."}
        </Alert>
      )}

      {sessions.isSuccess && sessions.data.length > 0 && (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <SearchBox
            label="Search sessions"
            placeholder="Search by session, hall or speaker"
            value={search}
            onChange={setSearch}
          />
          <SessionHallFilter
            venueId={event.venue?.id ?? null}
            sessions={sessions.data}
            value={hall}
            onChange={chooseHall}
          />
          {filtered && (
            <p className="pb-2.5 text-sm text-muted" role="status">
              Showing {shown.length} of{" "}
              {plural(sessions.data.length, "session")}
            </p>
          )}
        </div>
      )}

      {speakerName && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
          <p>
            Sessions of <strong>{speakerName}</strong>
          </p>
          <Link
            href={eventSessionsHref(event.id)}
            className={buttonStyles({ variant: "secondary" })}
          >
            Show all sessions
          </Link>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {sessions.isPending ? (
          <div
            role="status"
            aria-label="Loading sessions"
            className="animate-pulse space-y-3 p-5 motion-reduce:animate-none"
          >
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-14 rounded bg-surface-subtle" />
            ))}
          </div>
        ) : sessions.isError ? (
          <div className="p-5">
            <Alert tone="error" title="We couldn't load the sessions">
              {sessions.error.message}
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => void sessions.refetch()}
              >
                Try again
              </Button>
            </Alert>
          </div>
        ) : sessions.data.length === 0 ? (
          <div className="space-y-3 px-5 py-10 text-center">
            <p className="text-muted">This event has no sessions yet.</p>
            {editable && canCreate && (
              <Link
                href={eventSessionNewHref(event.id)}
                className={buttonStyles({ variant: "primary" })}
              >
                Add the first session
              </Link>
            )}
          </div>
        ) : shown.length === 0 && ofSpeaker.length === 0 ? (
          <div className="space-y-3 px-5 py-10 text-center">
            <p className="text-muted">
              This speaker is not on any session of this event.
            </p>
          </div>
        ) : shown.length === 0 && term !== "" ? (
          <div className="space-y-3 px-5 py-10 text-center">
            <p className="text-muted">{`No session matches “${term}”.`}</p>
            <Button variant="secondary" onClick={() => setSearch("")}>
              Clear search
            </Button>
          </div>
        ) : shown.length === 0 ? (
          <div className="space-y-3 px-5 py-10 text-center">
            <p className="text-muted">
              {`No session is in ${hallName ?? "this hall"}.`}
            </p>
            <Button
              variant="secondary"
              onClick={() => chooseHall(ALL_HALLS, null)}
            >
              Show all sessions
            </Button>
          </div>
        ) : (
          <EventSessionsTable
            eventId={event.id}
            eventSlug={event.slug}
            eventStatus={event.status}
            sessions={shown}
            timezone={event.timezone}
            canEdit={editable}
            onCancel={setCancelling}
          />
        )}
      </div>

      <CancelSessionDialog
        session={cancelling}
        isPending={cancel.isPending}
        error={cancel.isError ? cancel.error.message : null}
        onClose={closeDialog}
        onConfirm={(session) =>
          cancel.mutate(session.id, { onSuccess: closeDialog })
        }
      />
    </div>
  );
}
