"use client";

import Link from "next/link";
import { formatEventDates, thumbDate } from "@/src/core/format/format-zoned";
import { Badge, Button, buttonStyles, cn } from "@/src/core/ui";
import { publicEventPath } from "../routes";
import type { MyTicketDto } from "../schemas/registrations.schemas";
import { bookedSessionsLabel, myTicketState } from "../utils/my-ticket-state";

const dot = (
  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
);

/**
 * One row of "My tickets": the date block, the event, the ticket's status, its code and the
 * booked sessions, and what can be done with it. The parent owns the dialogs (show ticket,
 * cancel), so a row only asks for them.
 */
export function MyTicketCard({
  ticket,
  now,
  onShowTicket,
  onCancel,
}: {
  ticket: MyTicketDto;
  now: Date;
  onShowTicket: (ticket: MyTicketDto) => void;
  onCancel: (ticket: MyTicketDto) => void;
}) {
  const { registration, event } = ticket;
  const state = myTicketState(ticket, now);
  const thumb = thumbDate(event.startAt, event.timezone);
  const eventHref = publicEventPath(event.slug);
  const live = state.kind === "registered";
  const place =
    event.venueName && event.venueCity
      ? `${event.venueName}, ${event.venueCity}`
      : (event.venueName ?? "Online");

  return (
    <li className="flex flex-wrap items-start gap-4 border-b border-line p-4 last:border-b-0 sm:p-5">
      <div
        aria-hidden="true"
        className="w-14 flex-none overflow-hidden rounded-md border border-line text-center"
      >
        <span className="block bg-surface-subtle py-0.5 text-[11px] font-bold text-danger">
          {thumb.month}
        </span>
        <span className="block py-1 text-xl font-semibold">{thumb.day}</span>
      </div>

      <div className="min-w-0 flex-[1_1_16rem] space-y-1.5">
        <h3 className="font-semibold">
          <Link href={eventHref} className="hover:underline">
            {event.title}
          </Link>
        </h3>
        <p className="text-sm text-muted">
          {formatEventDates(event.startAt, event.endAt, event.timezone, {
            weekday: true,
          })}{" "}
          · {place}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <>
              <Badge tone="success">{dot}Registered</Badge>
              <span className="text-sm text-muted">{state.when}</span>
            </>
          ) : (
            <Badge tone="danger">{dot}Registration cancelled</Badge>
          )}
          {state.kind === "event_cancelled" && (
            <Badge tone="neutral">Event cancelled</Badge>
          )}
        </div>
        {state.kind === "event_cancelled" && (
          <p className="text-sm text-muted">
            The organiser cancelled this event, so your registration and seats
            were cancelled.
          </p>
        )}
        {state.kind === "cancelled" && (
          <p className="text-sm text-muted">
            You cancelled this registration. A new ticket code is issued if you
            register again.
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Ticket code
          </span>
          <span
            className={cn(
              "font-mono font-semibold tracking-wider",
              !live && "text-muted line-through",
            )}
          >
            {registration.ticketCode}
          </span>
          {live && (
            <span className="text-muted">
              {bookedSessionsLabel(ticket.bookedSessionCount)}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {live && (
          <Button variant="primary" onClick={() => onShowTicket(ticket)}>
            Show ticket
          </Button>
        )}
        <Link
          href={eventHref}
          className={buttonStyles({ variant: "secondary" })}
        >
          View event
        </Link>
        {state.kind === "cancelled" && state.canRegisterAgain && (
          <Link
            href={eventHref}
            className={buttonStyles({ variant: "secondary" })}
          >
            Register again
          </Link>
        )}
        {live && state.canCancel && (
          <button
            type="button"
            onClick={() => onCancel(ticket)}
            aria-label={`Cancel registration for ${event.title}`}
            className="px-2 text-sm font-semibold text-danger hover:underline"
          >
            Cancel registration
          </button>
        )}
      </div>
    </li>
  );
}
