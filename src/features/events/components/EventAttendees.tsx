"use client";

import { Alert } from "@/src/core/ui";
import { EventAttendeeList } from "@/src/features/registrations";
import type { EventOverviewData } from "../types/event-manage.types";
import { EventLoader } from "./EventLoader";
import { EventPageHeader } from "./EventPageHeader";

/**
 * The Registrations tab of one event (URL …/attendees), for its organizer or an admin: the
 * event's header and tabs, then who registered (the registrations feature's list, route 5):
 * counts, search, filters, an event day for a multi-day event, and the table. The door is the
 * Check-in tab.
 */
export function EventAttendees({ eventId }: { eventId: string }) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => <AttendeesPage overview={overview} />}
    </EventLoader>
  );
}

function AttendeesPage({ overview }: { overview: EventOverviewData }) {
  const { event } = overview;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader overview={overview} current="attendees" />

      <div>
        <h2 className="text-lg font-semibold">Registrations</h2>
        <p className="text-muted">
          Everyone who registered for this event. Search by name, email or
          ticket code. To let people in, use the Check-in tab.
        </p>
      </div>

      {event.status === "draft" && (
        <Alert tone="info" title="Nobody can register yet">
          Registrations open once you publish the event.
        </Alert>
      )}

      <EventAttendeeList
        event={{
          id: event.id,
          startAt: event.startAt,
          endAt: event.endAt,
          timezone: event.timezone,
          capacity: event.capacity,
          sessionBookings: overview.sessionBookings,
        }}
      />
    </div>
  );
}
