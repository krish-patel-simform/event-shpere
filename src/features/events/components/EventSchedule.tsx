"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonStyles, Card, cn, SourceBadge, Tabs } from "@/src/core/ui";
import {
  SAMPLE_HALLS,
  SAMPLE_SESSIONS,
  SAMPLE_SPEAKERS,
  type SampleSession,
  type SampleSessionType,
} from "../sample/organizer-sample";
import { eventSessionNewHref } from "../routes";
import type { EventOverviewData } from "../types/event-manage.types";
import { formatTicketPrice } from "../utils/event-display";
import { PUBLIC_SESSION_TYPE_LABELS } from "../utils/public-event-display";
import {
  blockBox,
  boardHeight,
  boardHours,
  eventDays,
  HOUR_PX,
  sessionsInHall,
  slotLabel,
  speakerNames,
  unscheduledSessions,
  type PlacedSession,
} from "../utils/schedule-board";
import { EventLoader } from "./EventLoader";
import { EventPageHeader } from "./EventPageHeader";
import { StaticDataNotice } from "./StaticDataNotice";

const PANEL_ID = "schedule-board";

/** How a block is coloured by what kind of session it holds. */
const TYPE_STYLES: Record<SampleSessionType, string> = {
  keynote: "border-brand/40 bg-brand-soft text-brand-soft-foreground",
  talk: "border-line bg-surface-subtle text-foreground",
  workshop: "border-success/40 bg-success-soft text-success",
  panel: "border-warning/40 bg-warning-soft text-warning",
};
const CANCELLED_STYLE = "border-dashed border-line bg-surface text-muted";

/** One placed session, drawn where its time falls in its hall's column. */
function SessionBlock({ session }: { session: PlacedSession }) {
  const { top, height } = blockBox(session.startMinute, session.endMinute);
  const speakers = speakerNames(session, SAMPLE_SPEAKERS);
  const full = session.booked !== null && session.booked >= hallSeats(session);

  return (
    <li
      className={cn(
        "absolute inset-x-1 overflow-hidden rounded-md border px-2 py-1 text-xs leading-snug",
        session.cancelled ? CANCELLED_STYLE : TYPE_STYLES[session.type],
      )}
      style={{ top, height: Math.max(height - 2, 0) }}
    >
      <p
        className={cn(
          "truncate text-sm font-semibold",
          session.cancelled && "line-through",
        )}
        title={session.title}
      >
        {session.title}
      </p>
      <p className="truncate">
        {slotLabel(session)}
        {speakers && ` · ${speakers}`}
        {session.cancelled && " · Cancelled"}
      </p>
      {session.booked !== null && !session.cancelled && (
        <p className="truncate">
          {session.booked} of {hallSeats(session)}
          {full && " · full"}
        </p>
      )}
    </li>
  );
}

/** The seats of the session's hall (a booking is limited by it). */
function hallSeats(session: PlacedSession): number {
  return SAMPLE_HALLS.find((hall) => hall.id === session.hallId)?.seats ?? 0;
}

function Legend() {
  const items: { label: string; style: string }[] = [
    { label: "Keynote", style: TYPE_STYLES.keynote },
    { label: "Talk", style: TYPE_STYLES.talk },
    { label: "Workshop", style: TYPE_STYLES.workshop },
    { label: "Panel", style: TYPE_STYLES.panel },
    { label: "Cancelled", style: CANCELLED_STYLE },
  ];
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className={cn("size-3 rounded-xs border", item.style)}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function UnscheduledCard({ session }: { session: SampleSession }) {
  const speakers = speakerNames(session, SAMPLE_SPEAKERS);
  return (
    <li className="min-w-56 flex-[1_1_16rem] rounded-md border border-line p-3">
      <p className="font-semibold">{session.title}</p>
      <p className="text-sm text-muted">
        {PUBLIC_SESSION_TYPE_LABELS[session.type]} ·{" "}
        {speakers || "No speaker yet"}
        {session.price > 0 && ` · ${formatTicketPrice(session.price)}`}
      </p>
    </li>
  );
}

function Board({ day, dayLabel }: { day: number; dayLabel: string }) {
  const hours = boardHours();
  const columns = `3.5rem repeat(${SAMPLE_HALLS.length}, minmax(10rem, 1fr))`;
  const placedToday = SAMPLE_HALLS.some(
    (hall) => sessionsInHall(SAMPLE_SESSIONS, day, hall.id).length > 0,
  );

  return (
    <div className="space-y-3">
      <div
        // The board is wider than a phone: it scrolls sideways, and a keyboard user can focus it.
        tabIndex={0}
        role="region"
        aria-label={`Schedule board, ${dayLabel}`}
        className="overflow-x-auto rounded-md border border-line"
      >
        <div className="min-w-176">
          <div
            className="grid border-b border-line bg-surface-subtle"
            style={{ gridTemplateColumns: columns }}
          >
            <div />
            {SAMPLE_HALLS.map((hall) => (
              <div key={hall.id} className="px-3 py-2">
                <p className="text-sm font-semibold">{hall.name}</p>
                <p className="text-xs text-muted">{hall.seats} seats</p>
              </div>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: columns }}>
            <ol
              aria-hidden="true"
              className="relative text-xs text-muted"
              style={{ height: boardHeight() }}
            >
              {hours.map((hour, row) => (
                <li
                  key={hour}
                  className={cn(
                    "absolute right-2",
                    row > 0 && "-translate-y-2",
                  )}
                  style={{ top: row * HOUR_PX }}
                >
                  {hour}
                </li>
              ))}
            </ol>
            {SAMPLE_HALLS.map((hall) => (
              <ul
                key={hall.id}
                aria-label={`${hall.name}, ${dayLabel}`}
                className="relative border-l border-line"
                style={{
                  height: boardHeight(),
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--line) ${HOUR_PX - 1}px, var(--line) ${HOUR_PX}px)`,
                }}
              >
                {sessionsInHall(SAMPLE_SESSIONS, day, hall.id).map(
                  (session) => (
                    <SessionBlock key={session.id} session={session} />
                  ),
                )}
              </ul>
            ))}
          </div>
        </div>
      </div>
      {!placedToday && (
        <p className="text-sm text-muted">
          Nothing is placed on {dayLabel} yet.
        </p>
      )}
    </div>
  );
}

/**
 * The organizer's Schedule board tab of one event: the sessions that still need a hall and a
 * time, and the day's programme as one column per hall. The event's header is real; the board
 * itself is sample data (Static) until the schedule API exists, and dragging a card onto a hall
 * is not built yet.
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
  const days = eventDays(event.startAt, event.endAt, event.timezone);
  const [dayIndex, setDayIndex] = useState(0);
  const day = days[dayIndex] ?? days[0];
  const waiting = unscheduledSessions(SAMPLE_SESSIONS);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader overview={overview} current="schedule" />

      <StaticDataNotice>
        This board shows example sessions. Nothing is loaded from the server
        yet.
      </StaticDataNotice>

      <Card
        title={`Not scheduled (${waiting.length})`}
        action={
          <Link
            href={eventSessionNewHref(event.id)}
            className={buttonStyles({ variant: "secondary" })}
          >
            <Plus aria-hidden="true" className="size-4" />
            Create session
          </Link>
        }
      >
        {waiting.length === 0 ? (
          <p className="text-muted">Every session has a hall and a time.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {waiting.map((session) => (
              <UnscheduledCard key={session.id} session={session} />
            ))}
          </ul>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          <SourceBadge source="static" />
          Dragging a card onto a hall and a time is not built yet. Set a
          session&apos;s hall and time by editing the session.
        </p>
      </Card>

      <Card>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              label="Event day"
              tabs={days.map((item) => ({
                key: String(item.index),
                label: item.label,
              }))}
              value={String(day.index)}
              onChange={(key) => setDayIndex(Number(key))}
              panelId={PANEL_ID}
            />
          </div>
          <Legend />
          <div
            id={PANEL_ID}
            role="tabpanel"
            aria-labelledby={`${PANEL_ID}-tab-${day.index}`}
          >
            <Board day={day.index} dayLabel={day.label} />
          </div>
        </div>
      </Card>
    </div>
  );
}
