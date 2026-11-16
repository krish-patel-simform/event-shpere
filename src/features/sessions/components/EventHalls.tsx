"use client";

import { LayoutDashboard, List, MapPinned } from "lucide-react";
import Link from "next/link";
import {
  ActionMenu,
  Alert,
  Badge,
  Button,
  buttonStyles,
  Card,
  type ActionMenuItem,
} from "@/src/core/ui";
import {
  EventLoader,
  EventPageHeader,
  eventEditHref,
  eventScheduleHref,
  eventSessionsHref,
  isEventEditable,
  type EventOverviewData,
} from "../../events";
import { useGetVenueDetail } from "../../venues";
import { useGetEventSessions } from "../hooks/useGetEventSessions";
import { hallRows, hallSessionsText } from "../utils/hall-usage";

const TH = "px-4 py-2.5 font-semibold";

/**
 * The organizer's Halls tab of one event: the halls of its venue (GET /api/venues/[id]), in the
 * order they are columns on the schedule board, and how many of THIS event's sessions each holds
 * (from the event's sessions). Halls belong to the venue, so they are read-only here: an
 * administrator adds, renames and activates them. The event loads first (it names the venue).
 */
export function EventHalls({ eventId }: { eventId: string }) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => <HallsPage overview={overview} />}
    </EventLoader>
  );
}

function HallsPage({ overview }: { overview: EventOverviewData }) {
  const { event } = overview;
  const venue = event.venue;
  const editable = isEventEditable(event.status);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader overview={overview} current="halls" />

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[2_1_32rem]">
          {venue ? (
            <HallsTable
              eventId={event.id}
              venueId={venue.id}
              venueName={`${venue.name}, ${venue.city}`}
            />
          ) : (
            <Alert tone="info" title="This event has no venue yet">
              Halls belong to the event&apos;s venue.{" "}
              {editable && (
                <Link
                  href={eventEditHref(event.id)}
                  className="font-semibold underline"
                >
                  Choose a venue
                </Link>
              )}
            </Alert>
          )}
        </div>

        <div className="min-w-0 flex-[1_1_20rem]">
          <Card title="About halls">
            <div className="space-y-3">
              <p>
                Halls belong to the venue, not to the event. They are added,
                renamed and activated or deactivated by an administrator.
              </p>
              <p className="text-muted">
                A hall that is inactive can&apos;t be used for new sessions.
                Sessions already placed in it keep their slot.
              </p>
              <Alert tone="info">
                Need another hall? Ask an administrator to add it to the venue,
                then it appears here.
              </Alert>
              {editable && (
                <Link
                  href={eventEditHref(event.id)}
                  className={buttonStyles({ variant: "secondary" })}
                >
                  <MapPinned aria-hidden="true" className="size-4" />
                  Change venue
                </Link>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HallsTable({
  eventId,
  venueId,
  venueName,
}: {
  eventId: string;
  venueId: string;
  venueName: string;
}) {
  const venue = useGetVenueDetail(venueId);
  const sessions = useGetEventSessions(eventId);

  function rowActions(): ActionMenuItem[] {
    return [
      {
        label: "View on schedule board",
        icon: LayoutDashboard,
        href: eventScheduleHref(eventId),
      },
      {
        label: "See sessions in this hall",
        icon: List,
        href: eventSessionsHref(eventId),
      },
    ];
  }

  if (venue.isPending) {
    return (
      <div
        role="status"
        aria-label="Loading halls"
        className="animate-pulse space-y-3 rounded-lg border border-line bg-surface p-5 motion-reduce:animate-none"
      >
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-12 rounded bg-surface-subtle" />
        ))}
      </div>
    );
  }

  if (venue.isError) {
    return (
      <Alert tone="error" title="We couldn't load the halls">
        {venue.error.message}
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => void venue.refetch()}
        >
          Try again
        </Button>
      </Alert>
    );
  }

  // The counts come from the event's sessions: while they load, or if they fail, the halls are
  // still listed and the count says so instead of showing a wrong number.
  const rows = hallRows(venue.data.halls, sessions.data ?? []);

  return (
    <Card
      flush
      title={`Halls at ${venueName}`}
      description="Halls appear as columns on the schedule board in this order."
    >
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-muted">
          This venue has no halls yet. An administrator adds them.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Halls of this event&apos;s venue
            </caption>
            <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className={TH}>
                  Order
                </th>
                <th scope="col" className={TH}>
                  Hall
                </th>
                <th scope="col" className={TH}>
                  Seats
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
              {rows.map((row, index) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3 text-muted">{index + 1}</td>
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="px-4 py-3">{row.capacity}</td>
                  <td className="px-4 py-3">
                    {sessions.isSuccess ? (
                      hallSessionsText(row)
                    ) : sessions.isError ? (
                      <span
                        className="text-muted"
                        title="The sessions could not be loaded"
                      >
                        —
                      </span>
                    ) : (
                      <span className="text-muted">…</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={row.isActive ? "success" : "neutral"}>
                      {row.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      label={`Actions for ${row.name}`}
                      items={rowActions()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sessions.isError && (
        <p className="border-t border-line px-4 py-3 text-sm text-muted">
          The session counts could not be loaded.{" "}
          <button
            type="button"
            className="font-semibold text-link hover:underline"
            onClick={() => void sessions.refetch()}
          >
            Try again
          </button>
        </p>
      )}
    </Card>
  );
}
