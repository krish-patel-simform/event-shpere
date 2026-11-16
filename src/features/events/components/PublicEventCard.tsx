import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/src/core/ui";
import { publicEventHref } from "../routes";
import type { PublicEventListItemDto } from "../schemas/event-public.schemas";
import {
  formatEventDates,
  formatTicketPrice,
  seatsLeftBadge,
  thumbDate,
} from "../utils/event-display";

/**
 * One event in the browse grid: banner (or a plain tinted block when the organizer has none), the
 * start date, title, dates, place, price and seats left. The whole card opens the event's page.
 */
export function PublicEventCard({ event }: { event: PublicEventListItemDto }) {
  const date = thumbDate(event.startAt, event.timezone);
  const seats = seatsLeftBadge(event.seatsLeft);
  const place = event.venue
    ? `${event.venue.name}, ${event.venue.city}`
    : "Venue to be announced";

  return (
    <li className="relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface hover:border-brand focus-within:border-brand">
      <div className="relative h-33 bg-brand-soft">
        {event.coverImage && (
          // A plain <img>: the banner comes from the CMS host, which next/image would have to be
          // configured for. The API only sends http(s) URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImage.url}
            alt={event.coverImage.alt ?? ""}
            loading="lazy"
            className="size-full object-cover"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute left-3.5 top-3.5 w-13 overflow-hidden rounded-md bg-surface text-center shadow-sm"
        >
          <span className="block pt-0.5 text-[11px] font-bold text-danger">
            {date.month}
          </span>
          <b className="block pb-1 text-xl leading-tight">{date.day}</b>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-4 py-3.5">
        {/* The link covers the whole card (after:inset-0), so a click anywhere opens the event. */}
        <Link
          href={publicEventHref(event.slug)}
          className="text-base font-semibold leading-snug hover:underline after:absolute after:inset-0 after:content-['']"
        >
          {event.title}
        </Link>
        {event.tagline && (
          <p className="line-clamp-2 text-sm text-muted">{event.tagline}</p>
        )}
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          {formatEventDates(event.startAt, event.endAt, event.timezone, {
            weekday: true,
          })}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          {place}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-4 py-3">
        <span className="font-bold">
          {formatTicketPrice(event.ticketPrice)}
        </span>
        <Badge tone={seats.tone}>{seats.text}</Badge>
      </div>
    </li>
  );
}
