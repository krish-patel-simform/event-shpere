import Link from "next/link";
import { Badge, buttonStyles, Card, cn } from "@/src/core/ui";
import { formatCount } from "@/src/core/format/format-number";
import type {
  OrganizerEvent,
  OrganizerEventStatus,
} from "../../types/organizer-home";
import { formatDateRange, formatPrice } from "../../utils/home-format";
import { EmptyState } from "../EmptyState";
import { ProgressBar } from "../ProgressBar";

const STATUSES: Record<
  OrganizerEventStatus,
  {
    label: string;
    tone: "success" | "neutral" | "danger" | "brand";
    action: string;
  }
> = {
  published: { label: "Published", tone: "success", action: "Manage" },
  draft: { label: "Draft", tone: "neutral", action: "Continue" },
  completed: { label: "Completed", tone: "brand", action: "Analytics" },
  cancelled: { label: "Cancelled", tone: "danger", action: "View" },
};

/** A bar turns amber from this share of the seats. */
const ALMOST_FULL = 0.9;

function RegistrationsCell({ event }: { event: OrganizerEvent }) {
  const { registrations } = event;
  if (registrations.kind === "text") {
    return <span className="text-muted">{registrations.text}</span>;
  }
  const almostFull =
    registrations.registered / registrations.capacity >= ALMOST_FULL;

  return (
    <div className="min-w-36">
      <p className="mb-1">
        {formatCount(registrations.registered)} /{" "}
        {formatCount(registrations.capacity)}
      </p>
      <ProgressBar
        value={registrations.registered}
        max={registrations.capacity}
        label={`Seats taken for ${event.title}`}
        tone={almostFull ? "warning" : "brand"}
      />
    </div>
  );
}

function EventRow({ event }: { event: OrganizerEvent }) {
  const status = STATUSES[event.status];

  return (
    <tr className="border-t border-line align-middle">
      <td className="px-4 py-3">
        <p
          className={cn(
            "font-semibold",
            event.status === "cancelled" && "text-muted line-through",
          )}
        >
          {event.title}
        </p>
        <p className="text-muted">
          {formatDateRange(event.startsAt, event.endsAt)} · {event.city} ·{" "}
          {formatPrice(event.priceInr)}
        </p>
      </td>
      <td className="px-4 py-3">
        <Badge tone={status.tone}>{status.label}</Badge>
      </td>
      <td className="px-4 py-3">
        <RegistrationsCell event={event} />
      </td>
      <td className="px-4 py-3">{event.sessionCount}</td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/events/${event.slug}`}
          aria-label={`${status.action} ${event.title}`}
          className={buttonStyles({ variant: "secondary" })}
        >
          {status.action}
        </Link>
      </td>
    </tr>
  );
}

/** The organizer's events with their status, seats taken and a link to manage each. */
export function OrganizerEventsCard({
  events,
}: {
  events: readonly OrganizerEvent[];
}) {
  return (
    <Card
      title="My events"
      flush
      action={
        <Link href="/events" className="text-sm font-semibold text-link">
          View all
        </Link>
      }
    >
      {events.length === 0 ? (
        <EmptyState>No events yet. Create your first event.</EmptyState>
      ) : (
        // Wide table: it scrolls inside the card on phones, not the whole page.
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Your events</caption>
            <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Event
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Registrations
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Sessions
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-right font-semibold"
                >
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
