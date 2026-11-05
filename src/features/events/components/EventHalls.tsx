"use client";

import { LayoutDashboard, List, MapPinned } from "lucide-react";
import Link from "next/link";
import {
  ActionMenu,
  Alert,
  Badge,
  buttonStyles,
  Card,
  SourceBadge,
  type ActionMenuItem,
} from "@/src/core/ui";
import { SAMPLE_HALLS, SAMPLE_SESSIONS } from "../sample/organizer-sample";
import { eventEditHref, eventScheduleHref, eventSessionsHref } from "../routes";
import type { EventOverviewData } from "../types/event-manage.types";
import { isEditable } from "../utils/event-display";
import { hallRows, hallSessionsText } from "../utils/event-halls";
import { EventLoader } from "./EventLoader";
import { EventPageHeader } from "./EventPageHeader";
import { StaticDataNotice } from "./StaticDataNotice";

const TH = "px-4 py-2.5 font-semibold";
const ROWS = hallRows(SAMPLE_HALLS, SAMPLE_SESSIONS);

/**
 * The organizer's Halls tab of one event: the halls of its venue, in the order they are columns on
 * the schedule board, and how many sessions each holds. Halls belong to the venue, so they are
 * read-only here. The event's header is real; the rows are sample data (Static) until the halls of
 * an event are loaded from the API, and reordering them is not built yet.
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

  function rowActions(): ActionMenuItem[] {
    return [
      {
        label: "View on schedule board",
        icon: LayoutDashboard,
        href: eventScheduleHref(event.id),
      },
      {
        label: "See sessions in this hall",
        icon: List,
        href: eventSessionsHref(event.id),
      },
    ];
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader overview={overview} current="halls" />

      <StaticDataNotice>
        These halls are examples. Nothing is loaded from the server yet.
      </StaticDataNotice>

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[2_1_32rem]">
          <Card
            flush
            title={venue ? `Halls at ${venue.name}, ${venue.city}` : "Halls"}
            description="Halls appear as columns on the schedule board in this order."
          >
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
                  {ROWS.map((row, index) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="px-4 py-3 text-muted">{index + 1}</td>
                      <td className="px-4 py-3 font-semibold">{row.name}</td>
                      <td className="px-4 py-3">{row.seats}</td>
                      <td className="px-4 py-3">{hallSessionsText(row)}</td>
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
            <p className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 text-sm text-muted">
              <SourceBadge source="static" />
              Reordering halls is not built yet.
            </p>
          </Card>
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
              {isEditable(event.status) && (
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
