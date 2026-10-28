import Link from "next/link";
import { Badge, buttonStyles, Card, cn } from "@/src/core/ui";
import type { AttendeeEvent } from "../../types/attendee-home";
import {
  formatDateRange,
  formatDayMonth,
  formatPrice,
  plural,
} from "../../utils/home-format";
import { DateTile } from "../DateTile";
import { EmptyState } from "../EmptyState";

function EventRow({ event }: { event: AttendeeEvent }) {
  const isCancelled = event.status === "cancelled";
  const href = `/events/${event.slug}`;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-b-0",
        isCancelled && "bg-danger-soft",
      )}
    >
      <DateTile iso={event.startsAt} muted={isCancelled} />
      <div className="min-w-0 flex-1 basis-60">
        {isCancelled ? (
          <>
            <p className="font-semibold text-muted line-through">
              {event.title}
            </p>
            <p className="text-sm text-danger">
              Cancelled by the organizer
              {event.cancelledAt && ` on ${formatDayMonth(event.cancelledAt)}`}.
              Your registration and bookings were cancelled.
            </p>
          </>
        ) : (
          <>
            <Link href={href} className="font-semibold hover:underline">
              {event.title}
            </Link>
            <p className="text-sm text-muted">
              {formatDateRange(event.startsAt, event.endsAt)} · {event.city} ·{" "}
              {formatPrice(event.priceInr)} ·{" "}
              {plural(event.sessionsBooked, "session")} booked
            </p>
          </>
        )}
      </div>
      {isCancelled ? (
        <Badge tone="danger">Event cancelled</Badge>
      ) : (
        <>
          <Badge tone="success">Registered</Badge>
          <Link
            href={href}
            aria-label={`Manage ${event.title}`}
            className={buttonStyles({ variant: "secondary" })}
          >
            Manage
          </Link>
        </>
      )}
    </li>
  );
}

/** The events the attendee registered for, soonest first, with cancelled ones marked. */
export function MyEventsCard({ events }: { events: readonly AttendeeEvent[] }) {
  return (
    <Card
      title="My events"
      flush
      action={
        <Link href="/events" className="text-sm font-semibold text-link">
          Browse events
        </Link>
      }
    >
      {events.length === 0 ? (
        <EmptyState>No upcoming events. Browse events to register.</EmptyState>
      ) : (
        <ul>
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ul>
      )}
    </Card>
  );
}
