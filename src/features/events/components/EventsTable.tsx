import { Ban, CalendarDays, ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatCount } from "@/src/core/format/format-number";
import {
  ActionMenu,
  Button,
  buttonStyles,
  ClickableRow,
  cn,
  TablePagination,
  type ActionMenuItem,
} from "@/src/core/ui";
import {
  eventEditHref,
  eventHref,
  EVENT_ROUTES,
  publicEventHref,
} from "../routes";
import type { ManagedEvent } from "../types/event-manage.types";
import {
  formatEventDates,
  isEditable,
  registrationsCell,
  sessionsCell,
  thumbDate,
  venueLine,
} from "../utils/event-display";
import { EventStatusBadge } from "./EventStatusBadge";
import { SeatsBar } from "./SeatsBar";

const TH = "px-4 py-2.5 font-semibold";

type EventsTableProps = {
  /** The events of this page, already filtered and sorted. */
  events: readonly ManagedEvent[];
  /** Events matching the filters, over all pages. */
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** A tab or filter is active, so an empty list means "no match". */
  isFiltered: boolean;
  onClearFilters: () => void;
  /** The organizer chose "Cancel event" on a row; the page asks to confirm. */
  onCancel: (event: ManagedEvent) => void;
  /** The organizer chose "Delete draft" on a row; the page asks to confirm. */
  onDelete: (event: ManagedEvent) => void;
};

/**
 * What a row's menu offers: open it, edit it (a completed or cancelled event is read-only), see
 * its public page (not for a draft: it has none yet), and last, in red, the way out: a published
 * event is cancelled, a draft is deleted.
 */
function rowActions(
  event: ManagedEvent,
  onCancel: (event: ManagedEvent) => void,
  onDelete: (event: ManagedEvent) => void,
): ActionMenuItem[] {
  const items: ActionMenuItem[] = [
    { label: "Manage event", href: eventHref(event.id), icon: CalendarDays },
  ];
  if (isEditable(event.status)) {
    items.push({
      label: "Edit details",
      href: eventEditHref(event.id),
      icon: Pencil,
    });
  }
  if (event.status !== "draft") {
    items.push({
      label: "View public page",
      href: publicEventHref(event.slug),
      icon: ExternalLink,
    });
  }
  if (event.status === "published") {
    items.push({
      label: "Cancel event",
      icon: Ban,
      tone: "danger",
      separatorBefore: true,
      onSelect: () => onCancel(event),
    });
  }
  if (event.status === "draft") {
    items.push({
      label: "Delete draft",
      icon: Trash2,
      tone: "danger",
      separatorBefore: true,
      onSelect: () => onDelete(event),
    });
  }
  return items;
}

/** The organizer's events: one row per event, the whole row opens its overview. */
export function EventsTable({
  events,
  total,
  page,
  pageSize,
  onPageChange,
  isFiltered,
  onClearFilters,
  onCancel,
  onDelete,
}: EventsTableProps) {
  if (events.length === 0) {
    return isFiltered ? (
      <div className="space-y-3 px-5 py-10 text-center">
        <p className="text-muted">No events match your filters.</p>
        <Button variant="secondary" onClick={onClearFilters}>
          Clear filters
        </Button>
      </div>
    ) : (
      <div className="space-y-3 px-5 py-10 text-center">
        <p className="text-muted">You have not created an event yet.</p>
        <Link
          href={EVENT_ROUTES.new}
          className={buttonStyles({ variant: "primary" })}
        >
          Create your first event
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Your events</caption>
          <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className={TH}>
                Event
              </th>
              <th scope="col" className={cn(TH, "whitespace-nowrap")}>
                Dates
              </th>
              <th scope="col" className={TH}>
                Registrations
              </th>
              <th scope="col" className={TH}>
                Sessions
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const registrations = registrationsCell(event);
              const sessions = sessionsCell(event);
              const thumb = thumbDate(event.startAt, event.timezone);
              return (
                <ClickableRow
                  key={event.id}
                  className="border-t border-line align-middle"
                >
                  <td className="min-w-64 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="flex h-10 w-14 flex-none flex-col items-center justify-center rounded bg-brand-soft text-[11px] font-bold leading-tight text-brand-soft-foreground"
                      >
                        <span>{thumb.day}</span>
                        <span>{thumb.month}</span>
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={eventHref(event.id)}
                          data-row-link
                          className="font-semibold hover:underline"
                        >
                          {event.title}
                        </Link>
                        <p className="text-muted">{venueLine(event)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatEventDates(
                      event.startAt,
                      event.endAt,
                      event.timezone,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {registrations.kind === "bar" ? (
                      <div className="min-w-36">
                        <p className="mb-1 font-semibold">
                          {formatCount(registrations.registered)} /{" "}
                          {formatCount(registrations.capacity)}
                        </p>
                        <SeatsBar
                          value={registrations.registered}
                          max={registrations.capacity}
                          label={`Seats taken for ${event.title}`}
                        />
                      </div>
                    ) : (
                      <span className="text-muted">{registrations.text}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {sessions.primary}
                    <p
                      className={cn(
                        "text-xs",
                        sessions.warn ? "text-warning" : "text-muted",
                      )}
                    >
                      {sessions.secondary}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={event.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      label={`Actions for ${event.title}`}
                      items={rowActions(event, onCancel, onDelete)}
                    />
                  </td>
                </ClickableRow>
              );
            })}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        itemCount={events.length}
        onPageChange={onPageChange}
      />
    </>
  );
}
