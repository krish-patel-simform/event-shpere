"use client";

import { EventCheckInDesk } from "@/src/features/registrations";
import type { EventOverviewData } from "../types/event-manage.types";
import { EventLoader } from "./EventLoader";
import { EventPageHeader } from "./EventPageHeader";

/**
 * The Check-in tab of one event (URL …/check-in), for its organizer or an admin: the event's
 * header and tabs, then the door (the registrations feature's desk, route 6). Who registered is
 * the Registrations tab; this page is only for letting people in.
 */
export function EventCheckIn({ eventId }: { eventId: string }) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => <CheckInPage overview={overview} />}
    </EventLoader>
  );
}

function CheckInPage({ overview }: { overview: EventOverviewData }) {
  const { event } = overview;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader overview={overview} current="check-in" />

      <div>
        <h2 className="text-lg font-semibold">Check-in</h2>
        <p className="text-muted">
          Let people in at the door: type or scan their ticket code.
        </p>
      </div>

      <EventCheckInDesk
        event={{
          id: event.id,
          startAt: event.startAt,
          endAt: event.endAt,
          timezone: event.timezone,
          status: event.status,
        }}
      />
    </div>
  );
}
