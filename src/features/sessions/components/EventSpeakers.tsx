"use client";

import { CalendarPlus, List } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ActionMenu,
  Alert,
  Avatar,
  Badge,
  Button,
  buttonStyles,
  Card,
  SourceBadge,
  TablePagination,
  type ActionMenuItem,
} from "@/src/core/ui";
import {
  EventLoader,
  EventPageHeader,
  SearchBox,
  eventSessionNewHref,
  isEventEditable,
  type EventOverviewData,
} from "../../events";
import { useGetSpeakerList } from "../../speakers";
import { useGetEventSessions } from "../hooks/useGetEventSessions";
import { eventSessionsOfSpeakerHref } from "../routes";
import {
  eventSpeakerRows,
  profileStatus,
  PROFILE_STATUS_META,
  searchEventSpeakers,
  type EventSpeakerRow,
} from "../utils/event-speakers";
import { SESSION_SPEAKER_ROLE_LABELS } from "../utils/organizer-session-display";

const PAGE_SIZE = 5;
const TH = "px-4 py-2.5 font-semibold";

/**
 * The organizer's Speakers tab of one event: the people who present ITS sessions (GET
 * /api/events/[id]/sessions), the sessions they present, and whether their public profile is
 * complete (from the speaker list). Speakers of other events are never listed. Someone is added to
 * the event by putting them on one of its sessions (the Details step of a session), so there is no
 * separate "add" here.
 */
export function EventSpeakers({ eventId }: { eventId: string }) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => <SpeakersPage overview={overview} />}
    </EventLoader>
  );
}

function SpeakersPage({ overview }: { overview: EventOverviewData }) {
  const { event } = overview;
  const editable = isEventEditable(event.status);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader overview={overview} current="speakers" />

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[2_1_32rem] space-y-3">
          <SpeakersList eventId={event.id} editable={editable} />
        </div>
        <div className="min-w-0 flex-[1_1_20rem]">
          <Card title="Add a speaker">
            <div className="space-y-3">
              <p>
                A speaker joins this event when you put them on one of its
                sessions. Choose them in the session&apos;s Details, under
                Speakers.
              </p>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <SourceBadge source="live" />
                This list is built from the event&apos;s sessions.
              </p>
              {editable && (
                <Link
                  href={eventSessionNewHref(event.id)}
                  className={buttonStyles({ variant: "secondary" })}
                >
                  <CalendarPlus aria-hidden="true" className="size-4" />
                  Add a session
                </Link>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SpeakersList({
  eventId,
  editable,
}: {
  eventId: string;
  editable: boolean;
}) {
  // Who is on the event comes from its sessions (the same list the other tabs use).
  const sessions = useGetEventSessions(eventId);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(
    () => eventSpeakerRows(sessions.data ?? []),
    [sessions.data],
  );

  if (sessions.isPending) {
    return (
      <div
        role="status"
        aria-label="Loading speakers"
        className="animate-pulse space-y-3 rounded-lg border border-line bg-surface p-5 motion-reduce:animate-none"
      >
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-14 rounded bg-surface-subtle" />
        ))}
      </div>
    );
  }

  if (sessions.isError) {
    return (
      <Alert tone="error" title="We couldn't load the speakers">
        {sessions.error.message}
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => void sessions.refetch()}
        >
          Try again
        </Button>
      </Alert>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface px-5 py-10 text-center">
        <p className="font-semibold">No speakers yet</p>
        <p className="mt-1 text-muted">
          Speakers appear here once they are on a session of this event.
        </p>
        {editable && (
          <Link
            href={eventSessionNewHref(eventId)}
            className={buttonStyles({ variant: "primary" }) + " mt-4"}
          >
            <CalendarPlus aria-hidden="true" className="size-4" />
            Add a session
          </Link>
        )}
      </div>
    );
  }

  const matches = searchEventSpeakers(rows, search);
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <>
      <div className="flex">
        <SearchBox
          label="Search assigned speakers"
          value={search}
          onChange={changeSearch}
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {matches.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">
            No speaker matches &ldquo;{search.trim()}&rdquo;.
          </p>
        ) : (
          <>
            <SpeakersTable rows={visible} eventId={eventId} />
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={matches.length}
              itemCount={visible.length}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </>
  );
}

/**
 * One page of the speakers. Their profile status (photo, content) is asked of the speakers API
 * for exactly these rows (`?ids=`): one request and one CMS call per page, however many speakers
 * the event has. The rows do not wait for it: the column shows "…" and then the badge. A new page
 * is a new query, so it never shows another page's badges.
 */
function SpeakersTable({
  rows,
  eventId,
}: {
  rows: readonly EventSpeakerRow[];
  eventId: string;
}) {
  // Sorted, so the same people in another order are the same cached request. Plain code-unit
  // order on purpose: it is a cache key, not text a person reads, so it must not depend on locale.
  const ids = useMemo(
    () =>
      rows.map((row) => row.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    [rows],
  );
  const cards = useGetSpeakerList({ ids, pageSize: ids.length });
  const cardById = useMemo(
    () => new Map((cards.data?.items ?? []).map((card) => [card.id, card])),
    [cards.data],
  );
  const cardsLoading = cards.isPending;

  // The Sessions tab narrowed to this speaker: the speaker is in the URL, so a reload keeps it.
  function rowActions(speakerId: string): ActionMenuItem[] {
    return [
      {
        label: "View sessions",
        icon: List,
        href: eventSessionsOfSpeakerHref(eventId, speakerId),
      },
    ];
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Speakers of this event</caption>
        <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className={TH}>
              Speaker
            </th>
            <th scope="col" className={TH}>
              Sessions
            </th>
            <th scope="col" className={TH}>
              Profile content
            </th>
            <th scope="col" className={TH}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const card = cardById.get(row.id);
            const status = card
              ? PROFILE_STATUS_META[profileStatus(card)]
              : null;
            return (
              <tr key={row.id} className="border-t border-line align-middle">
                <td className="min-w-56 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.name} />
                    <div>
                      <p className="font-semibold">{row.name}</p>
                      <p className="text-muted">
                        {row.roles
                          .map((role) => SESSION_SPEAKER_ROLE_LABELS[role])
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="min-w-56 px-4 py-3">
                  <strong>{row.sessionTitles.length}</strong>
                  <span className="text-muted">
                    {" · "}
                    {row.sessionTitles.join("; ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {status ? (
                    <Badge tone={status.tone}>{status.label}</Badge>
                  ) : (
                    <span
                      className="text-muted"
                      title={
                        cardsLoading
                          ? "Loading the profile"
                          : "The profile could not be loaded"
                      }
                    >
                      {cardsLoading ? "…" : "—"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionMenu
                    label={`Actions for ${row.name}`}
                    items={rowActions(row.id)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
