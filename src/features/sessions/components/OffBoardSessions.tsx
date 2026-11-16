"use client";

import { Pencil, Search } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Badge, Button, Card, cn } from "@/src/core/ui";
import { eventSessionEditHref } from "../routes";
import type { SessionDto } from "../schemas/sessions.schemas";
import { sessionWhen } from "../utils/schedule-sessions";

/** How many tiles show before "Show all": two rows of a wide screen, so many do not take over. */
export const OFF_BOARD_PREVIEW = 6;

/** Past this many the open grid scrolls inside the card instead of growing without end. */
const SCROLL_FROM = 12;

/** The bar on a tile's left edge, in the colour the same type has on the board. */
const TYPE_ACCENT: Record<SessionDto["type"], string> = {
  keynote: "border-l-session-keynote",
  talk: "border-l-session-talk",
  workshop: "border-l-session-workshop",
  panel: "border-l-session-panel",
};

/** "Ananya Rao", "Ananya Rao, Rohan Mehta", "Ananya Rao +2": a tile has room for two names. */
function speakerLine(session: SessionDto): string {
  const names = [...session.speakers]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((speaker) => speaker.name);
  if (names.length <= 2) return names.join(", ");
  return `${names[0]} +${names.length - 1}`;
}

function SessionTile({
  eventId,
  session,
  timezone,
}: {
  eventId: string;
  session: SessionDto;
  timezone: string;
}) {
  const cancelled = session.status === "cancelled";
  const speakers = speakerLine(session);

  return (
    <li
      className={cn(
        "group relative min-w-0 rounded-md border border-l-4 px-3 py-2 transition-colors hover:bg-surface-subtle",
        cancelled
          ? "border-dashed border-line bg-surface text-muted"
          : cn("border-line bg-surface", TYPE_ACCENT[session.type]),
      )}
    >
      <div className="flex items-center gap-2">
        <p
          title={session.title}
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-semibold",
            cancelled && "line-through",
          )}
        >
          {session.title}
        </p>
        {cancelled && <Badge tone="danger">Cancelled</Badge>}
        {session.mode !== "online" && (
          <Badge tone="neutral">Off the board</Badge>
        )}
        <Pencil
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted group-hover:text-link"
        />
      </div>
      <p className="flex min-w-0 gap-1 text-xs text-muted">
        <span className="shrink-0">
          {sessionWhen(session, timezone) ?? "No time yet"}
        </span>
        {speakers && <span className="truncate">· {speakers}</span>}
      </p>
      {/* The whole tile is the link: a click anywhere on it opens the edit page. */}
      <Link
        href={eventSessionEditHref(eventId, session.id)}
        aria-label={`Edit ${session.title}`}
        className="absolute inset-0 rounded-md"
      />
    </li>
  );
}

/**
 * The event's sessions that have no column on the schedule board, above the board: an online
 * session has no hall, so it can not be drawn in one. They are compact tiles in a grid, each with
 * the type's colour bar, when it is, who speaks, and a link to edit it; a cancelled one is dashed,
 * struck through and marked, as on the board. With many of them only the first few tiles show until
 * "Show all" is chosen, a search appears to find one by its title, and a very long open grid scrolls
 * inside the card.
 */
export function OffBoardSessions({
  eventId,
  sessions,
  timezone,
}: {
  eventId: string;
  /** Already in the order to show: running sessions by time, then the cancelled ones. */
  sessions: readonly SessionDto[];
  timezone: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const gridId = useId();
  const searchId = useId();

  const cancelled = sessions.filter(
    (session) => session.status === "cancelled",
  ).length;
  const searchable = sessions.length > OFF_BOARD_PREVIEW;
  const term = query.trim().toLowerCase();
  const matches = term
    ? sessions.filter((session) => session.title.toLowerCase().includes(term))
    : sessions;
  // A search shows every match: the person is looking for something, not browsing.
  const collapsed = !expanded && !term;
  const shown = collapsed ? matches.slice(0, OFF_BOARD_PREVIEW) : matches;
  const hidden = matches.length - shown.length;

  return (
    <Card
      title={`Not on the board (${sessions.length})`}
      description={`Online sessions have no hall, so they are not drawn on the board.${cancelled > 0 ? ` ${cancelled} cancelled.` : ""}`}
    >
      <div className="space-y-3">
        {searchable && (
          <div className="relative max-w-sm">
            <label htmlFor={searchId} className="sr-only">
              Search these sessions
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title"
              autoComplete="off"
              className="w-full rounded-md border border-field bg-surface py-2 pr-3 pl-9 text-sm placeholder:text-muted/70"
            />
          </div>
        )}
        {searchable && term && (
          <p role="status" className="text-sm text-muted">
            {matches.length === 0
              ? `No session matches “${query.trim()}”.`
              : `${matches.length} of ${sessions.length} sessions match.`}
          </p>
        )}
        {shown.length > 0 && (
          <div
            className={cn(
              !collapsed &&
                sessions.length > SCROLL_FROM &&
                "max-h-60 overflow-y-auto pr-1",
            )}
          >
            <ul
              id={gridId}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {shown.map((session) => (
                <SessionTile
                  key={session.id}
                  eventId={eventId}
                  session={session}
                  timezone={timezone}
                />
              ))}
            </ul>
          </div>
        )}
        {!term && sessions.length > OFF_BOARD_PREVIEW && (
          <Button
            variant="secondary"
            aria-expanded={expanded}
            aria-controls={gridId}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded
              ? "Show fewer"
              : `Show all ${sessions.length} (${hidden} more)`}
          </Button>
        )}
      </div>
    </Card>
  );
}
