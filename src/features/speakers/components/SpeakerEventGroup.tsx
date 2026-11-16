"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Badge, cn } from "@/src/core/ui";
import {
  plural,
  publicEventHref,
  publicSessionHref,
} from "@/src/features/events";
import type {
  SpeakerSessionGroupDto,
  SpeakerSessionTimeline,
} from "../schemas/speaker-sessions.schemas";
import {
  eventBadge,
  eventMeta,
  sessionBadge,
  sessionDetails,
  sessionWhen,
} from "../utils/speaker-session-display";

/**
 * One event with the speaker's sessions in it, which can be folded. The title opens the event;
 * each session opens its own page. `now` is the clock the "In 3 days" badge counts from.
 *
 * The fold slides: the rows sit in a grid whose one row animates from 0fr to 1fr, so the height
 * changes smoothly without knowing it. Folded rows are `inert` (no focus, hidden from screen
 * readers). Users who prefer reduced motion get no animation.
 */
export function SpeakerEventGroup({
  group,
  timeline,
  now,
}: {
  group: SpeakerSessionGroupDto;
  timeline: SpeakerSessionTimeline;
  now: Date;
}) {
  const { event, sessions } = group;
  const badge = eventBadge(timeline, event.startAt, now);
  const [open, setOpen] = useState(true);
  const listId = useId();

  return (
    <div className="rounded-lg border border-line">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${open ? "Collapse" : "Expand"} ${event.title}`}
          onClick={() => setOpen((current) => !current)}
          className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-subtle hover:text-foreground"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 transition-transform duration-200 motion-reduce:transition-none",
              !open && "-rotate-90",
            )}
          />
        </button>
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground"
        >
          <CalendarDays className="size-5" />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <Link
            href={publicEventHref(event.slug)}
            className="font-semibold hover:underline"
          >
            {event.title}
          </Link>
          <p className="text-sm text-muted">{eventMeta(event)}</p>
        </div>
        <span className="text-sm text-muted">
          {plural(sessions.length, "session")}
        </span>
        {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
      </div>

      <div
        id={listId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        {/* min-h-0 + overflow-hidden let the single grid row shrink to nothing. */}
        <div className="min-h-0 overflow-hidden">
          <ul>
            {sessions.map((session) => {
              const when = sessionWhen(session, event.timezone);
              const status = sessionBadge(timeline, session);
              return (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-3"
                >
                  <div className="w-44 shrink-0 text-sm">
                    <p className="font-semibold">{when.date}</p>
                    <p className="text-muted">{when.time}</p>
                  </div>
                  <div className="min-w-0 flex-1 basis-60">
                    <Link
                      href={publicSessionHref(event.slug, session.id)}
                      className="font-medium hover:underline"
                    >
                      {session.title}
                    </Link>
                    <p className="text-sm text-muted">
                      {sessionDetails(session)}
                    </p>
                  </div>
                  {status && <Badge tone={status.tone}>{status.text}</Badge>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
