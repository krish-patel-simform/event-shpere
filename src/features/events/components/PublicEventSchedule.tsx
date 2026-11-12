"use client";

import { useState } from "react";
import { Badge, tabId, Tabs } from "@/src/core/ui";
import { speakerHref } from "@/src/features/speakers";
import Link from "next/link";
import { publicSessionHref } from "../routes";
import type { PublicSessionDto } from "../schemas/event-public.schemas";
import { formatTicketPrice } from "../utils/event-display";
import {
  groupSessionsByDay,
  PUBLIC_SESSION_TYPE_LABELS,
  sessionMinutes,
  sessionStartTime,
  type TimedSession,
} from "../utils/public-event-display";

const PANEL_ID = "schedule-panel";

function SessionRow({
  session,
  slug,
  timezone,
}: {
  session: TimedSession;
  /** The event's public link, for the link to the session's own page. */
  slug: string;
  timezone: string;
}) {
  const place = session.hallName ?? "Online";
  return (
    <li className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-5 py-3.5">
      <div className="w-16 shrink-0 font-semibold">
        {sessionStartTime(session, timezone)}
        <p className="text-xs font-normal text-muted">
          {sessionMinutes(session)} min
        </p>
      </div>
      <div className="min-w-0 flex-1 basis-72">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={publicSessionHref(slug, session.id)}
            className="text-[15px] font-semibold hover:underline"
          >
            {session.title}
          </Link>
          <Badge tone="neutral">
            {PUBLIC_SESSION_TYPE_LABELS[session.type]}
          </Badge>
          {session.price > 0 && (
            <Badge tone="brand">+ {formatTicketPrice(session.price)}</Badge>
          )}
        </div>
        <p className="text-sm text-muted">
          {place}
          {session.speakers.map((speaker, index) => (
            <span key={speaker.slug}>
              {index === 0 ? " · " : ", "}
              <Link
                href={speakerHref(speaker.slug)}
                className="font-medium text-link hover:underline"
              >
                {speaker.name}
              </Link>
            </span>
          ))}
        </p>
      </div>
    </li>
  );
}

/**
 * The programme of a public event: one tab per day, each session with its time, hall and
 * speakers (who link to their pages). Sessions without a time are not on the programme yet.
 */
export function PublicEventSchedule({
  sessions,
  slug,
  timezone,
}: {
  sessions: readonly PublicSessionDto[];
  /** The event's public link: each session title links to /events/[slug]/sessions/[id]. */
  slug: string;
  timezone: string;
}) {
  const days = groupSessionsByDay(sessions, timezone);
  const [selected, setSelected] = useState<string | null>(null);
  // The chosen day, or the first one when none is chosen (or the chosen one is gone).
  const current = days.find((day) => day.key === selected) ?? days[0];

  return (
    <section
      id="schedule"
      aria-labelledby="schedule-heading"
      className="scroll-mt-4 overflow-hidden rounded-lg border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h2 id="schedule-heading" className="text-xl font-semibold">
          Schedule
        </h2>
        {days.length > 1 && (
          <Tabs
            label="Day"
            tabs={days.map((day) => ({ key: day.key, label: day.label }))}
            value={current.key}
            onChange={setSelected}
            panelId={PANEL_ID}
          />
        )}
      </div>
      {current ? (
        <>
          {/* The date of the sessions below: with one day there are no tabs to say it. */}
          <h3 className="border-t border-line bg-surface-subtle px-5 py-2.5 text-sm font-semibold">
            {current.date}
          </h3>
          <ul
            id={PANEL_ID}
            role={days.length > 1 ? "tabpanel" : undefined}
            aria-labelledby={
              days.length > 1 ? tabId(PANEL_ID, current.key) : undefined
            }
          >
            {current.sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                slug={slug}
                timezone={timezone}
              />
            ))}
          </ul>
        </>
      ) : (
        <p className="border-t border-line px-5 py-8 text-center text-muted">
          The programme has not been published yet.
        </p>
      )}
    </section>
  );
}
